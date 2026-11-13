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
  await page.screenshot({path:`test-results/${info.project.name}/interaction-${zone}-${id}.png`});
 }
});
