import {expect,test} from '@playwright/test';

test('cold-room tea interaction retains real sprites through sitting and rising',async({page},info)=>{
 const missing:string[]=[];
 page.on('console',message=>{if(/Texture.*(not found|missing)|Error loading.*sit-transition/i.test(message.text()))missing.push(message.text())});
 await page.goto('/');await page.locator('#custom-save').click({timeout:45000});
 await page.locator('#map-toggle').click();await page.locator('#item-tea').click();
 await expect(page.locator('#dialogue')).toBeHidden();
 await expect.poll(()=>page.evaluate(()=>{
  const scene=(window as any).__cottage;
  return {
   seat:scene.seated,
   settled:scene.seatedPhase>=scene.seatingDuration,
   poses:[scene.player.texture.key,scene.boy.texture.key].map(key=>/pose-4(?:-|$)/.test(key)),
  };
 }),{timeout:20000,message:'Both actors finish the tea seating animation and use the seated pose'}).toEqual({seat:'tea',settled:true,poses:[true,true]});
 const sprites=await page.evaluate(()=>{
  const scene=(window as any).__cottage;
  return [scene.player,scene.boy].map(actor=>{
   const source=actor.texture.getSourceImage();const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
   const g=canvas.getContext('2d')!;g.drawImage(source,0,0);const data=g.getImageData(0,0,canvas.width,canvas.height).data;
   let transparent=0,colored=0;for(let i=0;i<data.length;i+=4){if(data[i+3]<64)transparent++;else if(Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2])>20)colored++}
   return {key:actor.texture.key,transparent,colored,width:canvas.width,height:canvas.height};
  });
 });
 for(const sprite of sprites){expect(sprite.key).not.toMatch(/__MISSING|__WHITE/);expect(sprite.width).toBeGreaterThan(8);expect(sprite.height).toBeGreaterThan(8);expect(sprite.transparent).toBeGreaterThan(10);expect(sprite.colored).toBeGreaterThan(20)}
 await page.screenshot({path:`test-results/${info.project.name}/room-tea-seated.png`});
 await page.getByRole('button',{name:'起身，继续走走',exact:true}).click();
 await page.waitForFunction(()=>!(window as any).__cottage.seated);
 expect(missing).toEqual([]);
});
