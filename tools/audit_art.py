"""Inventory and contact sheets for manual art QA; file checks are not visual approval."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

root=Path(__file__).resolve().parents[1]
source=root/'tools/art-source'
destination=root.parents[1]/'outputs'
destination.mkdir(exist_ok=True)
records=[]
for path in sorted(source.glob('*.png')):
 with Image.open(path) as picture:
  picture.load()
  alpha=picture.getchannel('A') if 'A' in picture.getbands() else None
  record={'name':path.name,'dimensions':list(picture.size),'sourceBytes':path.stat().st_size,
          'alphaRange':list(alpha.getextrema()) if alpha else None,'visualReview':'pending'}
  final=path.stem.startswith('outdoor-') and len(path.stem.split('-'))==4
  record['role']='single-season-background' if final else 'comparison-only' if path.stem.startswith('outdoor-') else 'existing-art'
  published=root/'public/assets'/('seasons/'+path.stem.removeprefix('outdoor-')+'.webp' if final else path.stem+'.webp')
  if published.exists():
   with Image.open(published) as runtime:
    record['runtimeDimensions']=list(runtime.size)
    record['runtimeBytes']=published.stat().st_size
    record['runtimeAlphaRange']=list(runtime.getchannel('A').getextrema()) if 'A' in runtime.getbands() else None
  records.append(record)

font=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',12)
for category in ['existing-art','single-season-background']:
 selected=[r for r in records if r['role']==category]
 for start in range(0,len(selected),24):
  batch=selected[start:start+24];sheet=Image.new('RGB',(1000,192*((len(batch)+3)//4)), '#2a2631');draw=ImageDraw.Draw(sheet)
  for index,record in enumerate(batch):
   x=index%4*250;y=index//4*192
   # A checker surface makes alpha errors visible without flattening the source.
   for cy in range(y,y+160,8):
    for cx in range(x,x+248,8):draw.rectangle((cx,cy,cx+7,cy+7),fill='#7b7983' if ((cx-x)//8+(cy-y)//8)%2 else '#aeabb4')
   with Image.open(source/record['name']) as picture:
    picture=picture.convert('RGBA');picture.thumbnail((246,158),Image.Resampling.NEAREST)
    sheet.paste(picture,(x+(248-picture.width)//2,y+(160-picture.height)//2),picture)
   label=record['name'].removesuffix('.png')
   draw.text((x+3,y+162),label[:32],font=font,fill='white')
   draw.text((x+3,y+176),str(record['dimensions']),font=font,fill='#f1c797')
  sheet.save(destination/f'art-audit-{category}-{start//24+1}.png')

(root/'docs/art-audit.json').write_text(json.dumps({'note':'Inventory and contact sheets only; pending visual review is not a pass. Original PNGs preserved. Comparison grids excluded from seasonal export.','items':records},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'images':len(records),'singleBackgrounds':sum(r['role']=='single-season-background' for r in records),'contactSheets':str(destination)},ensure_ascii=False))
