import {expect,test} from '@playwright/test';

test.use({viewport:{width:844,height:390}});
test('display scaling preserves screen bounds and commits only after confirmation',async({page})=>{
 await page.goto('/');
 await page.locator('#custom-save').click({timeout:45000});
 if(await page.locator('#tools-toggle').isVisible())await page.locator('#tools-toggle').click();
 await page.locator('#settings').click();
 await page.getByRole('button',{name:'画面',exact:true}).click();
 await page.locator('#set-scale').selectOption('125');
 await expect.poll(()=>page.locator('#app').evaluate(node=>Math.abs(node.getBoundingClientRect().width-(window.visualViewport?.width??innerWidth)))).toBeLessThanOrEqual(1);
 await expect.poll(()=>page.locator('#app').evaluate(node=>Math.abs(node.getBoundingClientRect().height-(window.visualViewport?.height??innerHeight)))).toBeLessThanOrEqual(1);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('birthday-cottage-v2')!).settings.uiScale??100)).toBe(80);
 await page.locator('#scale-keep').click();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('birthday-cottage-v2')!).settings.uiScale)).toBe(125);
 await page.locator('#set-scale').selectOption('80');
 await page.locator('#scale-restore').click();
 await expect(page.locator('#set-scale')).toHaveValue('125');
 await page.locator('#close-modal').click();
 await page.reload();await page.locator('#continue').click({timeout:45000});
 await expect.poll(()=>page.locator('#app').evaluate(node=>Math.abs(node.getBoundingClientRect().width-(window.visualViewport?.width??innerWidth)))).toBeLessThanOrEqual(1);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('birthday-cottage-v2')!).settings.uiScale)).toBe(125);
});
