export type AppearanceColors={color:number;skin:number;outfit:number};
const hairColors=[[146,117,111],[91,55,39],[44,39,41],[161,64,57],[213,180,120],[185,124,147]];
const skinColors=[[255,215,187],[234,187,147],[193,136,95],[141,89,64]];
const outfitColors=[[116,160,187],[197,125,148],[230,220,192]];
/** The girl's sprites have cool pink highlights, particularly on hands and knees.
 * Grow a skin mask from light peach colors into their immediate rosy edges. */
function girlSkinMask(pixels:Uint8ClampedArray,width:number,height:number,left:number,right:number,head:boolean){
 const first=Math.floor(left*width),last=Math.ceil(right*width);
 const mask=new Uint8Array(width*height),seeds:number[]=[];
 for(let y=Math.floor(height*(head?.36:.34));y<height;y++)for(let x=first;x<last;x++){
  const i=y*width+x,n=i*4,r=pixels[n],g=pixels[n+1],b=pixels[n+2];
  const red=r-g,warm=g-b;
  if(pixels[n+3]<64||r<145||red<14||red>100||warm<0||warm>45||red<1.42*warm)continue;
  mask[i]=1;
  if(r>=216&&g>=153&&red>=21&&red<=67&&warm>=4){mask[i]=2;seeds.push(i)}
 }
 // One neighboring pixel carries the antialiased edge without recoloring the fringe or satchel.
 for(const i of seeds){
  const x=i%width;
  for(const next of [x>first?i-1:-1,x+1<last?i+1:-1,i-width,i+width]){
   if(mask[next]!==1)continue;
   mask[next]=2;
  }
 }
 return mask;
}
/** Recolor regions and source palette together; never change alpha or near-black ink. */
export function recolorAppearance(pixels:Uint8ClampedArray,width:number,height:number,who:'girl'|'boy',a:AppearanceColors,base=''){
 const pair=base.startsWith('pair-')||base.startsWith('holding-'),left=pair?(who==='girl'?0:.53):0,right=pair?(who==='girl'?.53:1):1;
 const girlMask=who==='girl'&&a.skin>0?girlSkinMask(pixels,width,height,left,right,base.startsWith('head-')):undefined;
 for(let y=0;y<height;y++)for(let x=Math.floor(left*width);x<Math.ceil(right*width);x++){
  const n=(y*width+x)*4,r=pixels[n],g=pixels[n+1],b=pixels[n+2],ny=y/height,nx=(x/width-left)/(right-left);
  if(pixels[n+3]<(girlMask?64:100)||Math.max(r,g,b)<66)continue;
  const skin=girlMask?girlMask[y*width+x]===2:r>g*1.04&&g>b*1.035&&r>158&&g>106&&r-g<74&&g-b<65;
  const torso=ny>.51&&ny<.77&&nx>.25&&nx<.75;
  const blue=b>r*1.05&&b>g*.98,green=g>r*1.02&&g>b*.9;
  // The boy's vest is brown/olive, unlike the girl's blue shirt. Limit it to
  // the central torso so hands, cheeks, brown trousers and hair retain identity.
  const brown=who==='boy'&&torso&&r>=65&&r<180&&g>=50&&g<145&&b<120&&r>=g*.94&&g>=b*1.02&&r-g<65;
  const cloth=torso&&(blue||green||brown)&&!(r>190&&g>180&&b>170);
  let target:number[]|undefined,shade=1;
  if(cloth&&a.outfit>0){target=outfitColors[a.outfit];shade=Math.max(.38,Math.min(1.22,(r+g+b)/(who==='boy'?335:460)))}
  else if(skin&&a.skin>0&&!cloth){target=skinColors[a.skin];shade=Math.max(.55,Math.min(1.15,(r+g+b)/630))}
  else if(a.color>0&&ny<.49&&!skin&&Math.max(r,g,b)-Math.min(r,g,b)<80&&Math.min(r,g,b)<190){target=hairColors[a.color];shade=Math.max(.32,Math.min(1.3,(r+g+b)/420))}
  if(target){pixels[n]=Math.min(255,target[0]*shade);pixels[n+1]=Math.min(255,target[1]*shade);pixels[n+2]=Math.min(255,target[2]*shade)}
 }
}
/** Skin islands separated from the central face are raised hands, not hair.
 * Preserve their original skin and a one-pixel ink boundary during head replacement. */
export function captureRaisedHands(pixels:Uint8ClampedArray,width:number,height:number,headBottom:number){
 const limit=Math.min(height,Math.ceil(headBottom)),seen=new Uint8Array(width*limit),parts:number[][]=[];
 const skin=(i:number)=>{const n=i*4,r=pixels[n],g=pixels[n+1],b=pixels[n+2];return pixels[n+3]>100&&r>160&&g>90&&r>g*1.12&&g>b*1.05};
 for(let i=0;i<seen.length;i++){if(seen[i]||!skin(i))continue;const part=[i];seen[i]=1;for(let k=0;k<part.length;k++){const j=part[k],x=j%width,y=Math.floor(j/width);for(const next of [x?j-1:-1,x+1<width?j+1:-1,y?j-width:-1,y+1<limit?j+width:-1])if(next>=0&&!seen[next]&&skin(next)){seen[next]=1;part.push(next)}}parts.push(part)}
 const face=parts.reduce<number[]>((best,p)=>{const cx=p.reduce((sum,i)=>sum+i%width,0)/p.length;return Math.abs(cx/width-.5)<.25&&p.length>best.length?p:best},[]);
 const keep=new Set<number>();for(const part of parts){if(part===face||part.length<3)continue;const cx=part.reduce((sum,i)=>sum+i%width,0)/part.length,cy=part.reduce((sum,i)=>sum+Math.floor(i/width),0)/part.length;if(cx>width*.25&&cx<width*.75&&cy<height*.35)continue;for(const i of part){const x=i%width,y=Math.floor(i/width);for(let yy=Math.max(0,y-1);yy<=Math.min(limit-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(width-1,x+1);xx++){const n=(yy*width+xx)*4;if(pixels[n+3]>64)keep.add(n)}}}
 return [...keep].map(n=>({n,rgba:[pixels[n],pixels[n+1],pixels[n+2],pixels[n+3]]}));
}
export function restoreRaisedHands(pixels:Uint8ClampedArray,saved:ReturnType<typeof captureRaisedHands>){for(const {n,rgba}of saved)pixels.set(rgba,n)}
