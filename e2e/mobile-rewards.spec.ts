import {expect,test} from '@playwright/test';
test.use({viewport:{width:844,height:390},hasTouch:true});
test('mobile DPI keeps joystick reachable and minimap below gift count',async({page},info)=>{
 await page.goto('/');await page.locator('#custom-save').click({timeout:45000});
 for(const dpi of [50,80,160]){
  await page.evaluate(value=>document.dispatchEvent(new CustomEvent('display-scale',{detail:value})),dpi);
  const bounds=await page.evaluate(()=>{const rect=(id:string)=>{const r=document.getElementById(id)!.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom}};return {stick:rect('joystick'),progress:rect('progress'),map:rect('round-minimap')}});
  expect(bounds.stick.w).toBeCloseTo(108,0);expect(bounds.stick.x).toBeGreaterThanOrEqual(36);expect(bounds.map.y).toBeGreaterThanOrEqual(bounds.progress.bottom+4);
  await page.evaluate(()=>(window as any).__cottage.bridge.emit('interact','hat'));
  const game=page.locator('#game-host');await expect(game).toBeVisible();await expect(game.locator(':scope > .modal-actions > button')).toHaveCount(3);
  await game.locator('.game-board button.lit').tap();
  await expect(game.locator('.game-board button.placed')).toHaveCount(1);
  await game.getByRole('button',{name:'先退出',exact:true}).tap();
 }
 await page.screenshot({path:`test-results/${info.project.name}/dpi-touch-and-hud.png`});
});
test('entry cannot be dismissed and reload resumes last floor position',async({page})=>{
 await page.goto('/');await page.locator('#custom-save').click({timeout:45000});
 await page.keyboard.press('ArrowRight',{delay:450});
 await page.waitForTimeout(3200);
 const pos=await page.evaluate(()=>JSON.parse(localStorage.getItem('birthday-cottage-v2')!).resume);
 expect(pos.zone).toBe('room');
 await page.reload();await expect(page.locator('#continue')).toBeVisible({timeout:45000});await page.keyboard.press('Escape');await expect(page.locator('#continue')).toBeVisible();await expect(page.locator('#close-modal')).toBeHidden();
 await page.locator('#continue').click();
 await expect.poll(()=>page.evaluate(()=>{const s=(window as any).__cottage;return s.transitioning?999:Math.hypot(s.player.x-JSON.parse(localStorage.getItem('birthday-cottage-v2')!).resume.x,s.player.y-JSON.parse(localStorage.getItem('birthday-cottage-v2')!).resume.y)})).toBeLessThan(3);
});
test('wish all grants each gift once and achievement gallery stays transparent',async({page})=>{
 await page.goto('/');await page.locator('#custom-save').click({timeout:45000});
 await page.evaluate(()=>document.dispatchEvent(new Event('open-wishes')));await expect(page.locator('#wish-all')).toBeVisible();await page.locator('#wish-all').click();await page.getByRole('button',{name:'跳过动画',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('birthday-cottage-v2')!).opened.length)).toBe(12);
 await page.evaluate(()=>document.dispatchEvent(new Event('open-achievements')));await expect(page.locator('.achievement-list .earned')).toHaveCount(2);await expect(page.locator('.stellar-panel')).toBeVisible();await page.locator('.stellar-close').click();
 expect(await page.evaluate(()=>new Set(JSON.parse(localStorage.getItem('birthday-cottage-v2')!).opened).size)).toBe(12);
});
