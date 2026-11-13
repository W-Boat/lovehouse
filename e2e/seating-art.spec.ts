import {test,expect} from '@playwright/test';
test('seat portraits and equipped accessories remain legible at front, rear and footbath seats',async({page},info)=>{
 test.setTimeout(180000);
 await page.addInitScript(()=>{if(!localStorage.getItem('birthday-cottage-v2'))localStorage.setItem('birthday-cottage-v2',JSON.stringify({version:2,hat:true,band:true,earphones:true,opened:['hat','band','earphones']}))});
 await page.goto('/');const entry=page.locator('#custom-save').or(page.locator('#continue'));await expect(entry.first()).toBeVisible({timeout:45000});await entry.first().click();await expect(page.locator('body')).toHaveClass(/started/);
 for(const [zone,seat]of [['room','chair-left'],['memory','memory-seat'],['hotspring','hotspring-seat']] as const){
  await page.evaluate(async({zone,seat})=>{const scene=(window as any).__cottage;if(scene.zone!==zone)await new Promise<void>(resolve=>scene.transitionTo(zone,resolve));scene.sit(seat)},{zone,seat});
  await page.waitForFunction(()=>{const scene=(window as any).__cottage;return scene.seatedPhase>1.3},{timeout:30000});
  const pose=await page.evaluate(()=>{const s=(window as any).__cottage;return{girl:s.player.texture.key,boy:s.boy.texture.key,hat:s.hat.visible,ears:s.earwear.visible,band:s.band.visible,aspect:s.player.displayWidth/s.player.displayHeight,source:s.player.texture.getSourceImage().width/s.player.texture.getSourceImage().height}});
  expect(pose.girl).toMatch(/pose-|soak-/);expect(pose.boy).toMatch(/pose-|soak-/);expect(pose.aspect).toBeCloseTo(pose.source,5);expect(pose.hat&&pose.ears&&pose.band).toBeTruthy();
  await page.screenshot({path:`test-results/${info.project.name}/seat-art-${zone}.png`});await page.evaluate(()=>(window as any).__cottage.stand());await page.waitForFunction(()=>!(window as any).__cottage.seated);
 }
});
