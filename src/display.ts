/** UI scale is independent of the physical size of touch controls. */
export const DEFAULT_DPI=80;
export const DPI_STEPS=Array.from({length:23},(_,i)=>50+i*5);
export const validDpi=(value:unknown):value is number=>typeof value==='number'&&DPI_STEPS.includes(value);
export function stickVector(dx:number,dy:number,diameter:number,scale:number){
 const limit=diameter*.32,length=Math.hypot(dx,dy),ratio=length>limit?limit/length:1;
 return {x:dx*ratio/limit,y:dy*ratio/limit,offsetX:dx*ratio/scale,offsetY:dy*ratio/scale};
}
