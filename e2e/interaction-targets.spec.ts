import {expect,test} from '@playwright/test';
test.use({viewport:{width:844,height:390},hasTouch:true});
async function tapWorld(page:import('@playwright/test').Page,x:number,y:number){
 const point=await page.evaluate(({x,y})=>{const app=document.getElementById('app')!,r=app.getBoundingClientRect(),p=(window as any).__cottage.project(x,y),width=parseFloat(app.style.width),height=parseFloat(app.style.height);return app.classList.contains('rotated')?{x:r.right-p.y/height*r.width,y:r.top+p.x/width*r.height}:{x:r.left+p.x/width*r.width,y:r.top+p.y/height*r.height}},{x,y});
 await page.touchscreen.tap(point.x,point.y);
}
test('touching adjacent gifts offers a compact choice and approaches the chosen gift',async({page},info)=>{
 await page.goto('/');await page.locator('#custom-save').click({timeout:45000});
 await page.waitForFunction(()=>Boolean((window as any).__cottage?.entered&&!((window as any).__cottage.cameras.main.fadeEffect.isRunning)));
 await tapWorld(page,156,262);const choices=page.locator('#interaction-choices');await expect(choices).toBeVisible();
 await expect(choices.locator('[data-item="chestnuts"]')).toBeVisible();await expect(choices.locator('[data-item="chocolate"]')).toBeVisible();
 expect(await choices.locator('button.interaction-choice').count()).toBe(2);
 const bounds=await choices.boundingBox();expect(bounds!.height).toBeLessThan((await page.evaluate(()=>innerHeight))*.5);
 await page.screenshot({path:`test-results/${info.project.name}/touch-target-choices.png`});
 await choices.locator('[data-item="chocolate"]').click();await expect(choices).toHaveCount(0);
 await expect(page.locator('#game-host h2')).toHaveText('刚刚好的一盒甜',{timeout:30000});
});
test('tapping the floor dismisses the object choice, and a nearby cue remains one line',async({page})=>{
 await page.goto('/');await page.locator('#custom-save').click({timeout:45000});
 await page.waitForFunction(()=>Boolean((window as any).__cottage?.entered&&!((window as any).__cottage.cameras.main.fadeEffect.isRunning)));
 await tapWorld(page,156,262);await expect(page.locator('#interaction-choices')).toBeVisible();
 await tapWorld(page,410,350);await expect(page.locator('#interaction-choices')).toHaveCount(0);
 if(!await page.locator('#map-toggle').isVisible())await page.locator('#tools-toggle').click();await page.locator('#map-toggle').click();await page.locator('#item-books').click();await expect(page.locator('#dialogue')).toBeHidden();
 await expect(page.locator('#nearby')).toBeVisible();
 const cue=await page.locator('#nearby').boundingBox();expect(cue!.height).toBeLessThan(52);
});
