from pathlib import Path
import re,json,hashlib,sys
from PIL import Image
from fontTools.ttLib import TTFont
from fontTools import subset
root=Path(__file__).resolve().parents[1]
assets=root/'public/assets';source=root/'tools/art-source';source.mkdir(exist_ok=True)
for p in list(assets.glob('*.png')):
 dest=source/p.name
 if not dest.exists():p.replace(dest)
for p in source.glob('*.png'):
 dest=assets/(p.stem+'.webp')
 if not dest.exists() or dest.stat().st_size<32 or dest.stat().st_mtime<p.stat().st_mtime:
  im=Image.open(p).convert('RGBA');im.thumbnail((1152,1152) if 'actions' in p.stem or p.stem in ['hero','characters','sitting','gifts','props','icons-v2','world-actors','wheel-actors'] else (768,512),Image.Resampling.NEAREST)
  im.save(dest,'WEBP',lossless=True,method=6)
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
 write('core.woff2',chars)
 css="@font-face{font-family:CottagePixel;src:url('./fonts/core.woff2') format('woff2');font-display:block;unicode-range:"+','.join('U+%X'%c for c in sorted(chars))+";}\n"
 groups={}
 for c in set(cmap)-chars:groups.setdefault(c//8192,set()).add(c)
 for group,cps in groups.items():
  name='extra-%x.woff2'%group;write(name,cps);css+="@font-face{font-family:CottagePixel;src:url('./fonts/"+name+"') format('woff2');font-display:swap;unicode-range:"+','.join('U+%X'%c for c in sorted(cps))+";}\n"
 (assets/'fonts.css').write_text(css,encoding='utf8')
 (root/'docs/font-report.json').write_text(json.dumps({'fixedCharacters':len(chars),'coreBytes':(folder/'core.woff2').stat().st_size,'chunks':len(groups)},indent=2),encoding='utf8')
 stamp.write_text(fingerprint)
 print('Prepared compressed art and subset pixel fonts')
