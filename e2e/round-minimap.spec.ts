import {test,expect,type Page} from '@playwright/test';

async function enter(page:Page){
 await page.goto('/');await expect(page.locator('#custom-save')).toBeVisible({timeout:45000});await page.locator('#custom-save').click();await expect(page.locator('body')).toHaveClass(/started/);
}
async function displaySettings(page:Page){
 await page.locator('#settings').click();await page.getByRole('button',{name:'画面',exact:true}).click();
}
test('nearby map can be hidden and its preference survives reload',async({page},info)=>{
 await enter(page);const map=page.locator('#round-minimap');await expect(map).toBeVisible();
 const shape=await map.evaluate(e=>{const r=e.getBoundingClientRect();return{width:r.width,height:r.height,left:r.left,top:r.top,radius:getComputedStyle(e).borderRadius}});
 expect(shape.width).toBe(shape.height);expect(shape.radius).toBe('50%');expect(shape.left).toBeLessThan(40);expect(shape.top).toBeLessThan(160);
 await page.screenshot({path:`test-results/${info.project.name}/round-minimap.png`});
 await displaySettings(page);await page.locator('#set-minimap').click();await expect(map).toBeHidden();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('birthday-cottage-v2')!).settings.minimap)).toBe(false);
 await page.reload();await expect(page.locator('#continue')).toBeVisible({timeout:45000});await page.locator('#continue').click();await expect(page.locator('#round-minimap')).toBeHidden();
 await displaySettings(page);await page.locator('#set-minimap').click();await page.locator('#close-modal').click();await expect(page.locator('#round-minimap')).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('birthday-cottage-v2')!).settings.minimap)).toBe(true);
});
test('clicking the nearby map opens the world overview without issuing movement',async({page})=>{
 await enter(page);const before=await page.evaluate(()=>{const s=(window as any).__cottage;s.stop();return{x:s.player.x,y:s.player.y,bx:s.boy.x,by:s.boy.y}});
 await page.locator('#round-minimap').click();await expect(page.locator('.world-node')).toHaveCount(18);await expect(page.locator('#modal-title')).toHaveText('我们的小世界');
 const after=await page.evaluate(()=>{const s=(window as any).__cottage;return{x:s.player.x,y:s.player.y,bx:s.boy.x,by:s.boy.y,moving:s.actor.moving,pending:Boolean(s.movingTo)}});
 expect(after.x).toBeCloseTo(before.x,4);expect(after.y).toBeCloseTo(before.y,4);expect(after.bx).toBeCloseTo(before.bx,4);expect(after.by).toBeCloseTo(before.by,4);expect(after.moving).toBeFalsy();expect(after.pending).toBeFalsy();
});
