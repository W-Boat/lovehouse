export type ImageSize={width:number;height:number};
export type ImageRect={x:number;y:number;w:number;h:number};
export function imageSize(image:CanvasImageSource):ImageSize{
 const s=image as unknown as {naturalWidth?:number;naturalHeight?:number;videoWidth?:number;videoHeight?:number;width?:number;height?:number};
 return {width:s.naturalWidth||s.videoWidth||s.width||0,height:s.naturalHeight||s.videoHeight||s.height||0};
}
/** Source coordinates are always derived from the decoded export, never its master PNG. */
export function normalizedCrop(source:ImageSize,rect:ImageRect):ImageRect{
 const x=Math.max(0,Math.min(1,rect.x))*source.width,y=Math.max(0,Math.min(1,rect.y))*source.height;
 return {x,y,w:Math.max(0,Math.min(source.width-x,rect.w*source.width)),h:Math.max(0,Math.min(source.height-y,rect.h*source.height))};
}
export function coverCrop(source:ImageSize,width:number,height:number):ImageRect{
 if(source.width<=0||source.height<=0||width<=0||height<=0)return{x:0,y:0,w:0,h:0};
 const factor=Math.max(width/source.width,height/source.height),w=width/factor,h=height/factor;
 return{x:(source.width-w)/2,y:(source.height-h)/2,w,h};
}
export function ceremonyCanvasHeight(width:number,height:number){return Math.max(1,Math.round(640*height/Math.max(1,width)))}
