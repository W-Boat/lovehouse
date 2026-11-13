import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
const art=JSON.parse(readFileSync(new URL('../content/ceremony-art.json',import.meta.url),'utf8')) as {wicks:[number,number][]};
async function flames(page:Page){return page.evaluate(wicks=>{
 const c=document.getElementById('ceremony-canvas') as HTMLCanvasElement,g=c.getContext('2d')!,pixels=g.getImageData(0,0,c.width,c.height).data;
 const h=Math.round(Math.min(245,c.height*.58)),w=Math.round(h*1.125),left=Math.round((640-w)/2),top=Math.round(c.height*.24);let warm=0;
 for(const [wx,wy]of wicks){const x=Math.round(left+wx*w),y=Math.round(top+wy*h);for(let py=Math.max(0,y-16);py<y;py++)for(let px=x-4;px<=x+4;px++){const i=(py*c.width+px)*4;if(pixels[i]>190&&pixels[i+1]>140&&pixels[i]>pixels[i+2]*1.25)warm++}}
 return warm;
},art.wicks)}
for(const spec of [{width:1280,height:720,dpi:80},{width:844,height:390,dpi:80},{width:1600,height:240,dpi:80},{width:915,height:412,dpi:125}]){
 test(`blow candles and fill fireworks ${spec.width}x${spec.height} DPI ${spec.dpi}`,async({page},info)=>{
  test.setTimeout(90000);await page.setViewportSize({width:spec.width,height:spec.height});
  await page.addInitScript(()=>{
   const draw=CanvasRenderingContext2D.prototype.drawImage;
   (window as any).__ceremonyDraws=[];
   CanvasRenderingContext2D.prototype.drawImage=function(...args:any[]){
    if(this.canvas.id==='ceremony-canvas'&&args.length===9){const source=args[0],list=(window as any).__ceremonyDraws;if(list.length<400)list.push({width:source.naturalWidth||source.width,height:source.naturalHeight||source.height,crop:args.slice(1,5),target:args.slice(5)})}
    return (draw as any).apply(this,args);
   } as typeof draw;
  });
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await page.locator('#custom-save').click({timeout:45000});
  await page.evaluate(dpi=>document.dispatchEvent(new CustomEvent('display-scale',{detail:dpi})),spec.dpi);
  await page.evaluate(()=>(window as any).__cottage.bridge.emit('interact','cake'));
  await expect(page.locator('#ceremony')).toBeVisible({timeout:30000});
  await expect.poll(()=>flames(page),{timeout:8000}).toBeGreaterThan(30);
  const before=await flames(page);
  const cakePixels=await page.locator('#ceremony-canvas').evaluate((node:HTMLCanvasElement)=>{const g=node.getContext('2d')!,data=g.getImageData(0,0,node.width,node.height).data;let warm=0;for(let i=0;i<data.length;i+=4)if(data[i]>150&&data[i+1]>70&&data[i]>data[i+2]*1.2)warm++;return warm});
  expect(cakePixels,'complete cream cake should be visible, not a clipped sliver').toBeGreaterThan(1000);
  await page.screenshot({path:`test-results/${info.project.name}/candles-${spec.width}-${spec.dpi}.png`});
  await page.locator('#ceremony-action').click();
  await expect.poll(()=>flames(page),{timeout:8000}).toBeLessThan(before*.3);
  await page.screenshot({path:`test-results/${info.project.name}/blown-${spec.width}-${spec.dpi}.png`});
  await expect(page.locator('#ceremony')).toHaveAttribute('data-stage','fireworks',{timeout:15000});
  await page.waitForTimeout(100);
  const geometry=await page.evaluate(()=>{const c=document.getElementById('ceremony-canvas') as HTMLCanvasElement,app=document.getElementById('app')!;return{ratio:c.height/c.width,expected:app.offsetHeight/app.offsetWidth,draws:(window as any).__ceremonyDraws}});
  expect(Math.abs(geometry.ratio-geometry.expected)).toBeLessThan(.002);
  expect(geometry.draws.length).toBeGreaterThan(0);
  for(const draw of geometry.draws){const [x,y,w,h]=draw.crop;expect(x).toBeGreaterThanOrEqual(0);expect(y).toBeGreaterThanOrEqual(0);expect(x+w).toBeLessThanOrEqual(draw.width+.01);expect(y+h).toBeLessThanOrEqual(draw.height+.01)}
  expect(geometry.draws.some((draw:any)=>draw.target[0]===0&&draw.target[1]===0&&draw.target[2]===640&&draw.target[3]>0),'background covers the full destination').toBe(true);
  await page.screenshot({path:`test-results/${info.project.name}/fireworks-${spec.width}-${spec.dpi}.png`});
  await page.locator('#ceremony-close').click();expect(errors).toEqual([]);
 });
}
