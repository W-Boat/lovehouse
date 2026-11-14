import {validatePortalUrl} from './cloud-portal-url.mjs';
export function validateLayers(value){
 if(value===undefined)return;
 if(!Array.isArray(value)||value.length>40)throw Error('Expected up to 40 scene layers');
 const ids=new Set();
 return value.map(layer=>{
  if(!layer||typeof layer.id!=='string'||!/^[a-z][a-z0-9-]{0,39}$/.test(layer.id)||ids.has(layer.id))throw Error('Invalid layer ID');
  ids.add(layer.id);
  const number=(key,fallback,min,max)=>{
   const n=layer[key]??fallback;if(!Number.isFinite(n)||n<min||n>max)throw Error('Invalid layer '+key);return n;
  };
  const result={id:layer.id,src:validatePortalUrl(layer.src),x:number('x',320,-640,1280),y:number('y',213,-426,852),width:number('width',64,1,1280),height:number('height',64,1,852),depth:number('depth',3,0,30),autoplay:layer.autoplay!==false};
  if(layer.trigger!==undefined){
   if(typeof layer.trigger!=='string'||!/^cloud-[a-z-]{1,33}$/.test(layer.trigger))throw Error('Invalid layer trigger');
   result.trigger=layer.trigger;
  }
  if(layer.frames!==undefined){
   const f=layer.frames;
   if(!f||![f.columns,f.rows].every(n=>Number.isInteger(n)&&n>=1&&n<=16)||f.columns*f.rows>128||!Number.isFinite(f.fps)||f.fps<1||f.fps>24||typeof f.loop!=='boolean')throw Error('Invalid animation frames');
   result.frames={columns:f.columns,rows:f.rows,fps:f.fps,loop:f.loop};
  }
  if(layer.path!==undefined){
   const p=layer.path;
   if(!p||!Array.isArray(p.points)||p.points.length<2||p.points.length>16||p.points.some(v=>!Array.isArray(v)||v.length!==2||!v.every(Number.isFinite)||v[0]<-640||v[0]>1280||v[1]<-426||v[1]>852)||!Number.isFinite(p.seconds)||p.seconds<.5||p.seconds>300)throw Error('Invalid animation path');
   result.path={points:p.points.map(point=>[...point]),seconds:p.seconds};
  }
  return result;
 });
}
