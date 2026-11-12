export type Viewport={width:number;height:number;rotated:boolean};
export function gameViewport(width:number,height:number):Viewport{return width<height?{width:height,height:width,rotated:true}:{width,height,rotated:false}}
export function localPoint(clientX:number,clientY:number,rect:{left:number;top:number;width:number;height:number},viewport:Viewport){return viewport.rotated?{x:(clientY-rect.top)*viewport.width/rect.height,y:(rect.left+rect.width-clientX)*viewport.height/rect.width}:{x:(clientX-rect.left)*viewport.width/rect.width,y:(clientY-rect.top)*viewport.height/rect.height}}
export function localDelta(x:number,y:number,rotated:boolean){return rotated?{x:y,y:-x}:{x,y}}
export async function requestImmersive(root:{requestFullscreen?:(options?:FullscreenOptions)=>Promise<void>;webkitRequestFullscreen?:()=>Promise<void>|void},orientation?:{lock?:(orientation:string)=>Promise<void>}){
 let fullscreen=false,landscape=false;
 try{if(root.requestFullscreen){await root.requestFullscreen({navigationUI:'hide'});fullscreen=true}else if(root.webkitRequestFullscreen){await root.webkitRequestFullscreen();fullscreen=true}}catch{/* In-app browsers may reject fullscreen. The game remains usable. */}
 try{if(orientation?.lock){await orientation.lock('landscape');landscape=true}}catch{/* CSS landscape is the fallback. */}
 return {fullscreen,landscape};
}
