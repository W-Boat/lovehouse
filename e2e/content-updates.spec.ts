import {expect,test} from '@playwright/test';

test('Android update controls validate the URL and follow native progress states',async({page})=>{
 await page.addInitScript(()=>{
  const state=window as any;state.nativeUpdates=[];
  state.CottageSave={postMessage:(text:string)=>{
   const message=JSON.parse(text);state.nativeUpdates.push(message);
   if(message.kind==='content-update'&&message.action==='status')document.dispatchEvent(new CustomEvent('cottage-update-status',{detail:{phase:'idle',message:'可检查资源更新',progress:0,version:30,url:'',availableVersion:0}}));
  }};
 });
 await page.goto('/');await page.locator('#custom-save').click({timeout:45000});
 await expect(page.locator('#fullscreen')).toBeHidden();
 await page.locator('#settings').click();await page.getByRole('button',{name:'关于',exact:true}).click();
 const input=page.locator('#content-update-url');
 await input.fill('http://example.test/update.json');await page.locator('#content-update-check').click();
 await expect(page.locator('#content-update-status')).toContainText('HTTPS');
 await input.fill('https://example.test/update.json');await page.locator('#content-update-check').click();
 expect(await page.evaluate(()=>(window as any).nativeUpdates.filter((m:any)=>m.action==='check'))).toEqual([{kind:'content-update',action:'check',url:'https://example.test/update.json'}]);
 const status=async(phase:string,progress=0)=>page.evaluate(({phase,progress})=>document.dispatchEvent(new CustomEvent('cottage-update-status',{detail:{phase,message:phase,progress,version:30,url:'https://example.test/update.json',availableVersion:31}})),{phase,progress});
 await status('available');await expect(page.locator('#content-update-install')).toBeEnabled();await page.locator('#content-update-install').click();
 await status('downloading',35);await expect(page.locator('#content-update-progress b.lit')).toHaveCount(7);await expect(input).toBeDisabled();
 await status('error');await expect(page.locator('#content-update-check')).toBeEnabled();await page.locator('#content-update-rollback').click();
 const commands=await page.evaluate(()=>(window as any).nativeUpdates.map((m:any)=>m.action));expect(commands).toContain('ready');expect(commands).toContain('install');expect(commands).toContain('rollback');
});
