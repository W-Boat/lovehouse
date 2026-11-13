from pathlib import Path
import re,json,hashlib,sys
from PIL import Image
from fontTools.ttLib import TTFont
from fontTools import subset
root=Path(__file__).resolve().parents[1]
assets=root/'public/assets';art_stamp=assets/'art-version.txt';rebuild_all=not art_stamp.exists() or art_stamp.read_text()!='pixel-atlas-v3';source=root/'tools/art-source';source.mkdir(exist_ok=True)
for p in list(assets.glob('*.png')):
 dest=source/p.name
 if not dest.exists():p.replace(dest)
sizes={'season-views':(768,512),'footbath-poses-v2':(384,256),'seats-back':(384,384),'weather-icons-v2':(192,128),'window-views':(640,426),'furniture':(512,512),'holding-walk-v2':(512,512),'holding-walk':(768,768),'loading-cottage':(384,384),'hero':(512,512),'characters':(512,256),'gifts':(512,384),'props':(512,256),'sitting':(256,256),'birthday-cake':(384,384),'girl-actions':(512,512),'boy-actions':(512,512),'girl-walk':(512,512),'boy-walk':(512,512),'icons-v2':(256,256),'gifts-v2':(256,256),'world-actors':(640,640),'wheel-actors':(512,512),'girl-heads':(512,512),'boy-heads':(512,512),'couple-actions':(768,576),'sit-transition':(768,256)}
cache_path=assets/'art-content-cache.json'
try:art_cache=json.loads(cache_path.read_text())
except (OSError,ValueError):art_cache={}
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def needs_export(p,dest,recipe):
 if rebuild_all or not dest.exists() or dest.stat().st_size<32:return True
 entry=art_cache.get(p.name)
 if entry:return entry!={'source':digest(p),'output':digest(dest),'recipe':recipe}
 return dest.stat().st_mtime<p.stat().st_mtime
def record_export(p,dest,recipe):art_cache[p.name]={'source':digest(p),'output':digest(dest),'recipe':recipe}
for p in source.glob('*.png'):
 if p.stem.startswith('pet-'):continue # normalized 6x96 animation strips are prepared separately
 # Seasonal backgrounds are generated individually. Four-up comparison sheets
 # remain in the source archive and must never become game backgrounds.
 if p.stem.startswith('outdoor-'):
  if not re.fullmatch(r'outdoor-(garden|forest|pier|station|postoffice|camp|ferris|market|mars)-(spring|summer|autumn|winter)-(day|night)',p.stem):continue
  folder=assets/'seasons';folder.mkdir(exist_ok=True)
  dest=folder/(p.stem.removeprefix('outdoor-')+'.webp')
  recipe='lossless-rgb-nearest-v1-768x512'
  if needs_export(p,dest,recipe):
   im=Image.open(p).convert('RGB');im.thumbnail((768,512),Image.Resampling.NEAREST)
   im.save(dest,'WEBP',lossless=True,method=6)
  record_export(p,dest,recipe)
  continue
 dest=assets/(p.stem+'.webp')
 target_size=(768,768) if p.stem=='interaction-props' else sizes.get(p.stem,(768,512))
 recipe=('pixel-alpha64-v2-' if p.stem=='interaction-props' else 'lossless-rgba-nearest-v1-')+str(target_size)
 if needs_export(p,dest,recipe):
  im=Image.open(p).convert('RGBA');im.thumbnail(target_size,Image.Resampling.NEAREST)
  if p.stem=='interaction-props':
   rgba=bytearray(im.tobytes())
   for index in range(0,len(rgba),4):
    if rgba[index+3]<=64:rgba[index:index+4]=bytes(4)
   im=Image.frombytes('RGBA',im.size,bytes(rgba))
  im.save(dest,'WEBP',lossless=True,method=6,exact=p.stem=='interaction-props')
 record_export(p,dest,recipe)
cache_path.write_text(json.dumps(art_cache,sort_keys=True,indent=2))
art_stamp.write_text('pixel-atlas-v3')
if (source/'icons-v2.png').exists():
 im=Image.open(source/'icons-v2.png');w,h=im.size;icon=im.crop((w//2,h*3//4,w*3//4,h));icon.thumbnail((64,64),Image.Resampling.NEAREST);icon.save(assets/'favicon.webp','WEBP',lossless=True)
 icons=root/'src-tauri/icons';icons.mkdir(exist_ok=True);icon.resize((256,256),Image.Resampling.NEAREST).save(icons/'icon.ico',format='ICO',sizes=[(32,32),(64,64),(128,128),(256,256)])
if '--art-only' in sys.argv:raise SystemExit(0)
font_source=next((root/'tools/font-source').glob('*zh_hans*.woff2'),None)
if font_source:
 text=''.join(p.read_text(encoding='utf-8-sig') for base in ['src','content'] for p in (root/base).rglob('*') if p.suffix in ['.ts','.css','.json'])+''.join(p.read_text(encoding='utf8') for p in root.glob('*.md'))
 fingerprint=hashlib.sha256(''.join(sorted(set(text))).encode()).hexdigest()
 stamp=assets/'font-hash.txt'
 if stamp.exists() and stamp.read_text()==fingerprint and (assets/'fonts.css').exists():
  print('Pixel font subset unchanged');raise SystemExit(0)
 chars={ord(c) for c in text}|set(range(32,127));original=TTFont(font_source);cmap=original.getBestCmap();chars&=set(cmap)
 folder=assets/'fonts';folder.mkdir(exist_ok=True)
 def write(name,cps):
  target=folder/name
  if name!='core.woff2' and target.exists():
   try:
    if set(cps).issubset(TTFont(target).getBestCmap()):return
   except Exception:pass
  f=TTFont(font_source);opt=subset.Options();opt.flavor='woff2';opt.layout_features=[];opt.drop_tables+=['GSUB','GPOS'];ss=subset.Subsetter(options=opt);ss.populate(unicodes=cps);ss.subset(f);f.save(folder/name)
 # Reuse the shipped supplemental fonts. Their actual cmap is authoritative:
 # changing the core subset must never trigger regenerating all 19 large chunks.
 groups={}
 for c in set(cmap):groups.setdefault(c//8192,set()).add(c)
 supplemental={};covered=set()
 for group,cps in groups.items():
  name='extra-%x.woff2'%group;target=folder/name
  if not target.exists():write(name,cps)
  actual=set(TTFont(target).getBestCmap())&set(cmap)
  supplemental[name]=actual;covered|=actual
 # Retain glyphs omitted by older chunk versions, so dynamic names stay complete.
 chars|=set(cmap)-covered
 write('core.woff2',chars)
 css="@font-face{font-family:CottagePixel;src:url('./fonts/core.woff2') format('woff2');font-display:block;unicode-range:"+','.join('U+%X'%c for c in sorted(chars))+";}\n"
 for name,actual in supplemental.items():
  extra=actual-chars
  if extra:css+="@font-face{font-family:CottagePixel;src:url('./fonts/"+name+"') format('woff2');font-display:swap;unicode-range:"+','.join('U+%X'%c for c in sorted(extra))+";}\n"
 (assets/'fonts.css').write_text(css,encoding='utf8')
 (root/'docs/font-report.json').write_text(json.dumps({'fixedCharacters':len(chars),'coreBytes':(folder/'core.woff2').stat().st_size,'chunks':len(groups)},indent=2),encoding='utf8')
 stamp.write_text(fingerprint)
 print('Prepared compressed art and subset pixel fonts')
