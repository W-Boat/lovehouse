import {test,expect} from '@playwright/test';
test('both wardrobes change real idle, seated, walking and paired pixels without erasing silhouettes',async({page},info)=>{
 test.setTimeout(120000);await page.goto('/');await expect(page.locator('#custom-save')).toBeVisible({timeout:45000});
 const pixels=async(who:'girl'|'boy')=>page.evaluate(w=>{const s=(window as any).__cottage;const sources=[s.poseSource(w,0),s.poseSource(w,4),s.walkingSource(w,3,1),s.coupleSource(2)];return sources.map((source:any)=>{if(!source)throw Error('missing wardrobe source');const c=document.createElement('canvas');c.width=source.width;c.height=source.height;const g=c.getContext('2d')!;g.drawImage(source,0,0);const p=g.getImageData(0,0,c.width,c.height).data;let hash=2166136261,opaque=0,alphaHash=2166136261;for(let i=0;i<p.length;i++){hash=Math.imul(hash^p[i],16777619);if(i%4===3){alphaHash=Math.imul(alphaHash^p[i],16777619);if(p[i]>100)opaque++}}return{hash:hash>>>0,opaque,alphaHash:alphaHash>>>0}})},who);
 for(const who of ['girl','boy'] as const){
  await page.selectOption('#'+who+'-outfit','0');const base=await pixels(who);const variants=[];
  for(const outfit of ['1','2']){await page.selectOption('#'+who+'-outfit',outfit);const changed=await pixels(who);for(let n=0;n<4;n++){expect(changed[n].hash,who+' outfit '+outfit+' frame '+n).not.toBe(base[n].hash);expect(changed[n].alphaHash).toBe(base[n].alphaHash)}variants.push(changed)}
  expect(variants[0][0].hash).not.toBe(variants[1][0].hash);
  for(const skin of ['1','2','3']){await page.selectOption('#'+who+'-skin',skin);const changed=await pixels(who);for(let n=0;n<4;n++){expect(changed[n].opaque).toBe(base[n].opaque);expect(changed[n].alphaHash).toBe(base[n].alphaHash)}}
  await page.selectOption('#'+who+'-skin','0');await page.selectOption('#'+who+'-outfit','0');
 }
 await page.selectOption('#boy-outfit','1');await page.selectOption('#girl-outfit','2');await page.locator('#custom-save').click();await expect(page.locator('body')).toHaveClass(/started/);await page.screenshot({path:`test-results/${info.project.name}/wardrobe-two-outfits.png`});
});
