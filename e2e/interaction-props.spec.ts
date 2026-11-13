import {expect,test} from '@playwright/test';

test('illustrated feedback renders real transparent props across every replacement type',async({page},info)=>{
 test.setTimeout(240000);
 await page.goto('/');await page.locator('#custom-save').click({timeout:45000});
 const cases=[['room','books'],['room','cabinet'],['room','candles'],['pier','bottle'],['greenhouse','greenhouse-water'],['greenhouse','greenhouse-vent'],['memory','memory-photos'],['station','station-bell'],['postoffice','postmark'],['camp','marshmallow'],['magic','potion'],['haunted','ghost-chess'],['cinema','popcorn'],['hotspring','spring-towel']];
 for(const [zone,id]of cases){
  await page.evaluate(async({zone,id})=>{
   const scene=(window as any).__cottage;
   if(scene.zone!==zone)await new Promise<void>(resolve=>scene.transitionTo(zone,resolve));
   scene.stop();scene.placeEffects.rebuild();await scene.prepareInteractionArt();scene.remember(id);
  },{zone,id});
  await page.waitForFunction(id=>Boolean((window as any).__cottage.placeEffects.props.get(id)?.visible),id,{timeout:15000});
  const sprite=await page.evaluate(id=>{const prop=(window as any).__cottage.placeEffects.props.get(id);return{key:prop.texture.key,width:prop.displayWidth,height:prop.displayHeight}},id);
  expect(sprite.key).toMatch(/^effect-/);expect(sprite.width).toBeGreaterThan(8);expect(sprite.height).toBeGreaterThan(8);
  const art=await page.evaluate(id=>{
   const scene=(window as any).__cottage,prop=scene.placeEffects.props.get(id),source=prop.texture.getSourceImage();
   const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
   const context=canvas.getContext('2d')!;context.drawImage(source,0,0);
   const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;let clear=0,solid=0;
   for(let i=3;i<pixels.length;i+=4){if(pixels[i]===0)clear++;if(pixels[i]>200)solid++}
   const missing:string[]=[];
   const visit=(objects:any[])=>{for(const object of objects){if(object.visible&&object.texture&&['__MISSING','__WHITE'].includes(object.texture.key))missing.push(object.texture.key);if(object.list)visit(object.list)}};
   visit(scene.children.list);
   return{clear,solid,missing};
  },id);
  expect(art.clear,'prop must have a transparent background: '+id).toBeGreaterThan(0);
  expect(art.solid,'prop must contain decoded foreground pixels: '+id).toBeGreaterThan(20);
  expect(art.missing,'visible scene objects must not use missing texture placeholders: '+id).toEqual([]);
  await page.screenshot({path:`test-results/${info.project.name}/interaction-${zone}-${id}.png`});
 }
});
