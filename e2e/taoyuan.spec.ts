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

test('a guest tills the shared farm without overwriting a personal slot',async({browser,baseURL})=>{
 test.setTimeout(120000);
 const hostContext=await browser.newContext({baseURL});
 const guestContext=await browser.newContext({baseURL});
 try{
  const host=await hostContext.newPage(),guest=await guestContext.newPage();
  await Promise.all([host,guest].map(async page=>{
   await page.goto('/');
   await page.locator('#custom-save').click({timeout:45000});
   await expect(page.locator('body')).toHaveClass(/started/);
   await page.locator('#online-toggle').click();
   await page.getByLabel('服务器地址（留空使用默认）').fill('ws://127.0.0.1:8787/online');
  }));
  await host.getByRole('button',{name:'创建双人房间',exact:true}).click();
  const roomInfo=host.locator('#online-room-info');
  await expect(roomInfo).toContainText('房间 ');
  const roomId=(await roomInfo.innerText()).match(/^房间 (\S+)/)![1];
  await guest.getByLabel('房间号',{exact:true}).fill(roomId);
  await guest.getByRole('button',{name:'加入房间',exact:true}).click();
  await expect(roomInfo).toContainText('副玩家 · 在线');
  await guest.evaluate(()=>localStorage.setItem('taoyuanxiang_save_0','personal-slot-marker'));
  await Promise.all([host,guest].map(async page=>{
   await page.getByRole('button',{name:'回到小屋',exact:true}).click();
   await page.getByRole('button',{name:/前往.*桃源乡/}).click();
   await expect(page.locator('#taoyuan-portal')).toBeVisible({timeout:15000});
  }));
  const hostFarm=host.frameLocator('#taoyuan-portal iframe');
  const guestFarm=guest.frameLocator('#taoyuan-portal iframe');
  await hostFarm.getByRole('button',{name:'新的旅程'}).click({timeout:20000});
  await hostFarm.getByRole('button',{name:'同意并继续'}).click();
  await hostFarm.getByPlaceholder('请输入你的名字').fill('小满');
  await hostFarm.getByRole('button',{name:'下一步'}).click();
  await hostFarm.getByRole('button',{name:/桃源田庄/}).click();
  await hostFarm.getByRole('button',{name:'开始旅程'}).click();
  const hostPlot=hostFarm.locator('.farm-plot').first();
  const guestPlot=guestFarm.locator('.farm-plot').first();
  await expect(hostPlot).toHaveAttribute('title',/荒地/);
  await expect(guestPlot).toHaveAttribute('title',/荒地/,{timeout:20000});
  await guestPlot.click();
  await expect(hostFarm.getByRole('button',{name:'开垦',exact:true})).toBeVisible();
  await guestFarm.getByRole('button',{name:'开垦',exact:true}).click();
  await expect(hostPlot).toHaveAttribute('title',/已耕地/);
  await expect(guestPlot).toHaveAttribute('title',/已耕地/,{timeout:15000});
  const saves=await guest.evaluate(()=>({
   personal:localStorage.getItem('taoyuanxiang_save_0'),
   shared:localStorage.getItem('lovehouse_taoyuan_guest_0')
  }));
  expect(saves.personal).toBe('personal-slot-marker');
  expect(saves.shared).toBeTruthy();
 }finally{await Promise.all([hostContext.close(),guestContext.close()])}
});
