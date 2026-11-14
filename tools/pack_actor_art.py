from pathlib import Path
from PIL import Image
import argparse,json,numpy as np
args=argparse.ArgumentParser(description='Pack full-body ImageGen atlases for the game.')
args.add_argument('generated_dir',type=Path)
args.add_argument('sources',type=Path)
options=args.parse_args()
source=options.generated_dir
ids=json.loads(options.sources.read_text(encoding='utf-8-sig'))
out=Path('public/assets/actor-art-v3');out.mkdir(parents=True,exist_ok=True)
manifest={'atlases':[],'solo':{'girl':{},'boy':{}},'pairs':{},'duo':{}}
count=0
def splits(projection,n):
 size=len(projection)
 points=[0]
 for i in range(1,n):
  target=size*i/n
  span=int(size/n*.29)
  center=round(target)
  point=min(range(max(points[-1]+1,center-span),min(size,center+span+1)),
            key=lambda k:sum(projection[max(0,k-2):k+3])+abs(k-target)*.08)
  points.append(point)
 return points+[size]

def add(name,cols,rows,lazy=None):
 global count
 im=Image.open(source/('exec-'+ids[name]+'.png')).convert('RGBA')
 frames=[]
 alpha=np.array(im.getchannel('A'))>64
 bounds_y=splits(alpha.sum(axis=1),rows)
 for y in range(rows):
  y0,y1=bounds_y[y:y+2]
  bounds_x=splits(alpha[y0:y1].sum(axis=0),cols)
  for x in range(cols):
   x0,x1=bounds_x[x:x+2]
   cell=im.crop((x0,y0,x1,y1))
   box=cell.getchannel('A').point(lambda a:255 if a>64 else 0).getbbox()
   if not box or box[2]-box[0]<cell.width*.16 or box[3]-box[1]<cell.height*.17:raise ValueError(f'Incomplete frame {name} at {x},{y}: {box}')
   if box[0]<=1 or box[1]<=1 or box[2]>=cell.width-1 or box[3]>=cell.height-1:
    print('Inspect cell border',name,x,y,box)
   frames.append(cell.crop(box))
 # Downsample the source once to the game texture resolution; onscreen actors are 64 px high.
 ratio=min(1,220/max(f.height for f in frames),320/max(f.width for f in frames))
 cellw=round(max(f.width for f in frames)*ratio)+8
 cellh=round(max(f.height for f in frames)*ratio)+8
 sheet=Image.new('RGBA',(cols*cellw,rows*cellh))
 for n,f in enumerate(frames):
  if ratio<1:f=f.resize((round(f.width*ratio),round(f.height*ratio)),Image.Resampling.LANCZOS)
  sheet.paste(f,((n%cols)*cellw+(cellw-f.width)//2,(n//cols+1)*cellh-f.height-4))
 sheet.save(out/(name+'.webp'),format='WEBP',quality=94,method=5,exact=True)
 keys=[f'art-v3-{name}-{n}' for n in range(cols*rows)]
 atlas={'source':f'actor-atlas-{name}','file':f'actor-art-v3/{name}.webp','cols':cols,'rows':rows,'frames':keys}
 if lazy is not None:manifest['pairs'][lazy]=atlas
 else:manifest['atlases'].append(atlas)
 count+=len(keys)
 return keys
def map_sequence(mapping,prefix,frames):
 for i,key in enumerate(frames):mapping[prefix+str(i)]=key
for who in ['girl','boy']:
 m=manifest['solo'][who]
 m[0]={}
 map_sequence(m[0],who+'-stride-',add(who+'Walk',4,4))
 map_sequence(m[0],who+'-pose-',add(who+'Pose',4,4))
 actions=add(who+'StyleActions',4,3)
 for i in range(1,4):
  if who+'Style'+str(i) not in ids:raise ValueError('Missing alternate hairstyle')
  layout=add(who+'Style'+str(i),4,4)
  m[i]={}
  for d in range(4):
   m[i][who+'-pose-'+str(d)]=layout[d]
   m[i][who+'-pose-'+str(4+d)]=layout[12+d]
   for step,k in enumerate([4+d,d,8+d,d]):m[i][who+'-stride-'+str(d*4+step)]=layout[k]
  for j,k in enumerate([0,1,1,0,2,3,2,3]):m[i][who+'-pose-'+str(8+j)]=actions[(i-1)*4+k]
  for j in range(6):m[i][who+'-sitmove-'+str(j)]=layout[12]
 if who=='girl' and 'eyesWalk' in ids and 'eyesPose' in ids:
  m[4]={}
  map_sequence(m[4],who+'-stride-',add('eyesWalk',4,4))
  pose=add('eyesPose',4,4)
  map_sequence(m[4],who+'-pose-',pose)
  for j in range(6):m[4][who+'-sitmove-'+str(j)]=pose[4]
for who in ['girl','boy']:
 name=who+'AltSeat'
 if name not in ids:continue
 styles=4 if who=='girl' else 3
 keys=add(name,4,styles)
 for style in range(1,styles+1):
  for i,frame in enumerate([0,1,1,2,2,3]):
   manifest['solo'][who][style][f'{who}-sitmove-{i}']=keys[(style-1)*4+frame]
seat=add('seat',6,2)
soak=add('soak',3,2)
for side,who in enumerate(['girl','boy']):
 m=manifest['solo'][who]
 map_sequence(m[0],who+'-sitmove-',seat[side*6:side*6+6])
 map_sequence(m[0],who+'-soak-',soak[side*3:side*3+3])
 for i in m:
  if i:
   for j in range(3):m[i][who+'-soak-'+str(j)]=m[i][who+'-pose-4']
def duo(look,hold,pair):
 m=manifest['duo'][look]={}
 map_sequence(m,'holding-art-',hold)
 map_sequence(m,'pair-art-',pair)
duo('0-0',add('holding',4,4),add('pair',4,3))
if 'eyesHolding' in ids and 'eyesPair' in ids:duo('4-0',add('eyesHolding',4,4),add('eyesPair',4,3))
for name in sorted(ids):
 if len(name)!=5 or not name.startswith('duo'):continue
 look=name[3]+'-'+name[4]
 k=add(name,4,5,lazy=look)
 duo(look,k[:4]+k[:4]+k[4:8]+k[:4],k[8:])
for girl in range(5):
 name=f'side{girl}'
 if name not in ids:continue
 keys=add(name,4,4,lazy=name)
 for boy in range(4):
  look=f'{girl}-{boy}'
  if look not in manifest['duo']:continue
  for direction,offset in ((1,4),(3,12)):
   for phase in range(4):
    if look in ('0-0','4-0'):continue
    # Only the open-eye sheet has two actual side-profile rows in each direction.
    row=offset if girl!=4 or phase%2 else offset-4
    manifest['duo'][look][f'holding-art-{direction*4+phase}']=keys[row+boy]
Path('content/actor-art.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Frames',count,'Pair combinations',len(manifest['duo']),'MiB',round(sum(p.stat().st_size for p in out.glob('*.webp'))/1024**2,2))
