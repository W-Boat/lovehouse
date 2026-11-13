import {expect,test} from '@playwright/test';

test('the central portal opens the packaged farm and returns control to the cottage',async({page},info)=>{
 const analyticsRequests:string[]=[];
 page.on('request',request=>{if(new URL(request.url()).hostname==='sdk.51.la')analyticsRequests.push(request.url())});
 await page.goto('/');
 await page.locator('#custom-save').click({timeout:45000});
 await expect(page.locator('body')).toHaveClass(/started/);
 await page.getByRole('button',{name:/前往.*桃源乡/}).click();
 const portal=page.locator('#taoyuan-portal');
 await expect(portal).toBeVisible({timeout:15000});
 const iframe=portal.locator('iframe');
 await expect(iframe).toHaveAttribute('src',/\/taoyuan\/index\.html$/);
 await expect(iframe.contentFrame().getByRole('button',{name:'新的旅程'})).toBeVisible({timeout:20000});
 await page.screenshot({path:`test-results/${info.project.name}/taoyuan-portal.png`});
 await portal.getByRole('button',{name:/返回生日小屋/}).click();
 await expect(portal).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>(window as any).__cottage.blocked)).toBe(false);
 expect(analyticsRequests).toEqual([]);
});
