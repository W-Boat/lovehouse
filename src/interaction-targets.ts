import type {Point} from './navigation';
/** Distances use physical CSS pixels, so zoom and display scaling do not shrink touch targets. */
export function interactionTargets<T extends Point&{id:string}>(items:readonly T[],point:Point,worldPerPixel:number,coarse:boolean){
 const unit=Math.max(.01,worldPerPixel),radius=(coarse?28:22)*unit;
 const nearby=items.map(item=>({item,distance:Math.hypot(item.x-point.x,item.y-point.y)}))
  .filter(hit=>hit.distance<=radius).sort((a,b)=>a.distance-b.distance||a.item.id.localeCompare(b.item.id));
 if(!nearby.length)return [];
 // A precise tap on an object stays direct; offer a choice only for an ambiguous gap.
 if(nearby[0].distance<4*unit&&(!nearby[1]||nearby[1].distance-nearby[0].distance>8*unit))return [nearby[0].item];
 return nearby.filter(hit=>hit.distance<=nearby[0].distance+8*unit).map(hit=>hit.item);
}
export type HintObstacle={left:number;top:number;right:number;bottom:number};
export function hintPosition(point:Point,width:number,height:number,hintWidth:number,hintHeight:number,obstacles:HintObstacle[]=[]){
 const half=Math.min(width/2-8,hintWidth/2);
 const clamp=(p:Point)=>({x:Math.max(half+8,Math.min(width-half-8,p.x)),y:Math.max(80+hintHeight,Math.min(height-72,p.y))});
 const preferred=clamp(point),fits=(p:Point)=>!obstacles.some(o=>p.x+half>o.left-6&&p.x-half<o.right+6&&p.y>o.top-6&&p.y-hintHeight<o.bottom+6);
 const options=[preferred,...obstacles.flatMap(o=>[{x:preferred.x,y:o.bottom+hintHeight+8},{x:preferred.x,y:o.top-8},{x:o.left-half-8,y:preferred.y},{x:o.right+half+8,y:preferred.y}]).map(clamp)];
 const available=options.filter(fits).sort((a,b)=>Math.hypot(a.x-preferred.x,a.y-preferred.y)-Math.hypot(b.x-preferred.x,b.y-preferred.y));
 return {...(available[0]??preferred),hidden:!available.length};
}
