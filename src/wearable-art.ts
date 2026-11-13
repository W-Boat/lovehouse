export type HeadAnchor={x:number;top:number;width:number;height:number;facing:number};
export function drawEarphones(g:CanvasRenderingContext2D,source:CanvasImageSource & {width:number;height:number},head:HeadAnchor){
 g.imageSmoothingEnabled=false;
 const {x,top,width,height,facing}=head,half=source.width/2;
 for(const side of [-1,1]){
  if((facing===1&&side===-1)||(facing===3&&side===1))continue;
  const h=height*.38,w=h*half/source.height,cx=x+side*width*.40;
  g.drawImage(source,side<0?0:half,0,half,source.height,cx-w/2,top+height*.53-h/2,w,h);
 }
}
export function drawHat(g:CanvasRenderingContext2D,source:CanvasImageSource & {width:number;height:number},head:HeadAnchor){
 g.imageSmoothingEnabled=false;
 const width=head.width*1.02,height=width*source.height/source.width;
 g.drawImage(source,head.x-width/2,head.top-height*.27,width,height);
}
