import {expect,test,type Page} from '@playwright/test';
async function enter(page:Page){
 await page.goto('/');
 await page.locator('#custom-save').click({timeout:45000});
 await expect(page.locator('body')).toHaveClass(/started/);
}
async function openGame(page:Page,zone:string,id:string){
 await page.evaluate(async ({zone,id})=>{
  const scene=(window as any).__cottage;
  await new Promise<void>(resolve=>scene.transitionTo(zone,resolve));
  scene.approachById(id);
 },{zone,id});
 const host=page.locator('#side-game-host');
 await expect(host).toBeVisible({timeout:20000});
 return host;
}
test('workshop makes, sells and settles one hawthorn order',async({page})=>{
 await enter(page);
 const host=await openGame(page,'tanghulu','sugar-sell');
 await host.getByRole('button',{name:/冰糖山楂/}).click();
 await expect(page.locator('#modal-backdrop')).toBeHidden();
 await host.getByRole('button',{name:'去备料台串果'}).click();
 await expect(host.getByRole('button',{name:'串上一颗'})).toBeVisible();
 await page.evaluate(()=>{
  const scene=(window as any).__cottage;
  scene.walk({x:320,y:370});
 });
 await expect(host.getByRole('button',{name:'串上一颗'})).toHaveCount(0);
 await host.getByRole('button',{name:'去备料台串果'}).click();
 for(let i=0;i<3;i++)await host.getByRole('button',{name:'串上一颗'}).click();
 await host.getByRole('button',{name:'去铜锅熬糖'}).click();
 for(let i=0;i<3;i++)await host.getByRole('button',{name:'添火'}).click();
 await host.getByRole('button',{name:'裹糖'}).click();
 await host.getByRole('button',{name:'去晾糖架'}).click();
 await host.getByRole('button',{name:'晾凉装袋'}).click();
 await host.getByRole('button',{name:'去柜台交单'}).click();
 await host.getByRole('button',{name:/交单/}).click();
 await host.getByRole('button',{name:'收摊结算'}).click();
 await expect(host).toContainText('净收益 4');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('birthday-cottage-v2')!).workshop.day)).toBe(2);
});
test('heartbeat jump animates the actual pixel character and saves a record',async({page})=>{
 await enter(page);
 const host=await openGame(page,'tianmo','heartbeat-jump');
 await expect(page.locator('#modal-backdrop')).toBeHidden();
 const actor=host.getByRole('img',{name:'正在跳跃的像素小人'});
 await expect(actor).toHaveAttribute('src',/^data:image\/png/);
 await host.getByRole('button',{name:'自动跳：关'}).click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('birthday-cottage-v2')!).jumpBest)).toBeGreaterThanOrEqual(4);
 await host.getByRole('button',{name:'自动跳：开'}).click();
 await expect(host.getByRole('button',{name:'按住蓄力'})).toBeEnabled();
 const landed=await page.evaluate(()=>JSON.parse(localStorage.getItem('birthday-cottage-v2')!).jumpBest);
 await page.waitForTimeout(1000);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('birthday-cottage-v2')!).jumpBest)).toBe(landed);
});
test('heartbeat landlord deals 17 cards, calls landlord and plays a valid hint',async({page})=>{
 await enter(page);
 const host=await openGame(page,'gulou','heartbeat-cards');
 await expect(host.locator('.playing-card')).toHaveCount(17);
 await host.getByRole('button',{name:'叫地主',exact:true}).click();
 await expect(host.locator('.playing-card')).toHaveCount(20);
 await host.getByRole('button',{name:'提示',exact:true}).click();
 await host.getByRole('button',{name:'出牌',exact:true}).click();
 await expect(host.locator('.playing-card')).not.toHaveCount(20);
});

test('cinema projects into the scene screen and releases the controls on exit',async({page})=>{
 await enter(page);
 await page.evaluate(async ()=>{
  const scene=(window as any).__cottage;
  await new Promise<void>(resolve=>scene.transitionTo('cinema',resolve));
  scene.approachById('movie');
 });
 const host=page.locator('#film-host');
 await expect(host.getByRole('button')).toHaveCount(3);
 await host.getByRole('button').first().click();
 const canvas=page.locator('#game-frame > .scene-projection canvas');
 await expect(canvas).toBeVisible();
 await expect(page.locator('#modal-backdrop')).toBeHidden();
 await page.keyboard.press('Escape');
 await expect(canvas).toHaveCount(0);
 expect(await page.evaluate(()=>(window as any).__cottage.blocked)).toBe(false);
});
