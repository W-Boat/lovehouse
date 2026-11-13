import {letterPieces} from '../src/letter-puzzle';
import {solveGiftPuzzle} from '../tools/solve-gift-puzzle';
import {test,expect,type Page} from '@playwright/test';
import {birthdayConfig} from '../content/birthday-config';
// Legal post-ceremony fixture: no gifts or game results are pre-completed.
async function enter(page:Page){await page.addInitScript(()=>{if(!localStorage.getItem('birthday-cottage-v2'))localStorage.setItem('birthday-cottage-v2',JSON.stringify({version:2,celebrated:true,onboarded:false,opened:[],games:{}}))});await page.goto('/');await expect(page.locator('#custom-save')).toBeVisible({timeout:45000});await page.locator('#custom-save').click()}
async function start(page:Page,id:string){await page.evaluate(value=>(window as any).__cottage.bridge.emit('interact',value),id);await expect(page.locator('#game-host')).toBeVisible()}
async function won(page:Page,id:string){
 await expect(page.locator('#game-host')).toHaveCount(0);
 await expect.poll(()=>page.evaluate(value=>JSON.parse(localStorage.getItem('birthday-cottage-v2')!).games[value]?.status,id),{message:'Game completion is persisted'}).toBe('won');
 // The gift ribbon animation intentionally precedes the single inventory grant.
 await expect.poll(()=>page.evaluate(value=>JSON.parse(localStorage.getItem('birthday-cottage-v2')!).opened.filter((x:string)=>x===value).length,id),{message:'Gift is granted once after its opening animation',timeout:10000}).toBe(1);
}


test('moon rotation, sentence fragments, notes, stitches and chocolate complete through real inputs',async({page})=>{
 test.setTimeout(180000);await enter(page);
 for(const id of ['moon','keychain','notes','hat','chocolate']){
  await start(page,id);
  for(let level=0;level<3;level++){
   const host=page.locator('#game-host'),board=host.locator('.game-board');
   if(id==='moon')for(let i=0;i<9;i++){const piece=board.locator(`[data-piece="${i}"]`);let rotation=(i+level)%4;do{await piece.click();rotation=(rotation+1)%4}while(rotation!==0);await board.locator(`[data-target="${i}"]`).click()}
   if(id==='keychain'){const chars=[...birthdayConfig.keychainLines[level]],mid=Math.ceil(chars.length/2);for(const text of [chars.slice(0,mid).join(''),chars.slice(mid).join('')||'。'])await board.getByRole('button',{name:text,exact:true}).click()}
   if(id==='notes'){await board.getByRole('button').nth(0).click();await board.getByRole('button').nth(3).click();await board.getByRole('button').nth(1).click();await board.getByRole('button').nth(2).click();await host.getByRole('button',{name:'检查顺序',exact:true}).click()}
   if(id==='hat')for(let i=0;i<9;i++)await board.locator('button.lit').click();
   if(id==='chocolate')for(const cell of (level===0?[0,2,8,10]:level===1?[0,4,8,12]:[0,2,4,6,8,10,12,14]))await board.getByRole('button').nth(cell).click();
  }
  await won(page,id);await page.locator('#close-modal').click();
 }
});
test('rhythm requires actual notes on all three rounds',async({page})=>{
 test.setTimeout(175000);await enter(page);await start(page,'earphones');
 // Repeated short presses still require genuine note-window hits; no callbacks or state injection.
 const until=Date.now()+140000;while(Date.now()<until&&await page.locator('#game-host').count()){
  for(const key of ['a','s','d'])await page.keyboard.press(key);await page.waitForTimeout(65);
 }
 await won(page,'earphones');
});
test('pause blocks chocolate placement and retry starts a fresh board',async({page})=>{
 await enter(page);await start(page,'chocolate');const host=page.locator('#game-host');await host.getByRole('button',{name:'暂停',exact:true}).click();await host.locator('.game-board button').nth(0).click({force:true});await expect(host.locator('.game-board')).not.toContainText('甜');await host.getByRole('button',{name:'继续',exact:true}).click();await host.locator('.game-board button').nth(0).click();await expect(host.locator('.game-board')).toContainText('甜');await host.getByRole('button',{name:'选项',exact:true}).click();await host.getByRole('button',{name:'重新开始',exact:true}).click();await expect(host.locator('.game-board')).not.toContainText('甜');await host.getByRole('button',{name:'先退出',exact:true}).click();await expect(host).toBeHidden();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('birthday-cottage-v2')!).opened.includes('chocolate'))).toBe(false);
});

test('route planning, push boxes and two-character switches solve all three distinct layouts',async({page})=>{
 test.setTimeout(180000);await enter(page);
 for(const id of ['band','labubu','mystery'] as const){await start(page,id);for(let level=0;level<3;level++){let side=0;for(const step of solveGiftPuzzle(id,level)){if(step.side!==side){await page.getByRole('button',{name:'切换角色',exact:true}).click();side=step.side}await page.locator('#game-host .game-board button').nth(step.target).click()}}await won(page,id);await page.locator('#close-modal').click()}
});

test('letter scraps rotate and drag into all three envelopes',async({page})=>{
 test.setTimeout(120000);await enter(page);await start(page,'letter');
 for(let level=0;level<3;level++)for(const piece of letterPieces(level)){
  const canvas=page.locator('#game-host canvas');await page.getByRole('button',{name:'选下一片',exact:true}).click();await canvas.focus();await canvas.scrollIntoViewIfNeeded();for(let i=piece.rotation;i%4!==0;i++)await page.keyboard.press('r');
  const geometry=await canvas.evaluate((node:HTMLCanvasElement)=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,w:node.width,h:node.height,rotated:document.getElementById('app')?.classList.contains('rotated')??false}});const pos=(x:number,y:number)=>geometry.rotated?({x:geometry.x+geometry.width-y/geometry.h*geometry.width,y:geometry.y+x/geometry.w*geometry.height}):({x:geometry.x+x/geometry.w*geometry.width,y:geometry.y+y/geometry.h*geometry.height});const from=pos(piece.x,piece.y),to=pos(piece.target.x,piece.target.y);
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:10});await page.mouse.up();
  if(piece.id<5)await expect(page.locator('.game-status')).toContainText(`已修好 ${piece.id+1} / 6 片`);else if(level<2)await expect(page.locator('.game-status')).toContainText(`第 ${level+2} / 3 封`);
 }
 await won(page,'letter');
});
test('claw catches and transports the doll using the real canvas and space key',async({page})=>{
 test.setTimeout(60000);await enter(page);await start(page,'doll');
 for(const x of [300,400,220]){
  const canvas=page.locator('#game-host canvas');await canvas.scrollIntoViewIfNeeded();const box=(await canvas.boundingBox())!;await page.mouse.move(box.x+x/600*box.width,box.y+box.height/2);await page.keyboard.press('Space');await expect(page.locator('.game-status')).toContainText('抓到了',{timeout:10000});await page.waitForTimeout(2000);await canvas.scrollIntoViewIfNeeded();const exit=(await canvas.boundingBox())!;await page.mouse.move(exit.x+70/600*exit.width,exit.y+exit.height/2);await page.keyboard.press('Space');
 }
 await won(page,'doll');
});
test('catch falling chestnuts by tracking visible pixels, through three rounds',async({page})=>{
 test.setTimeout(150000);await enter(page);await start(page,'chestnuts');await page.locator('#game-host canvas').scrollIntoViewIfNeeded();const deadline=Date.now()+120000;
 while(Date.now()<deadline){
  // Sample the drawing and its position together. The final catch can remove
  // the canvas between browser calls, so an absent board ends the input loop.
  const sample=await page.evaluate(()=>{
   const canvas=document.querySelector<HTMLCanvasElement>('#game-host canvas');
   if(!canvas)return null;
   const pixels=canvas.getContext('2d')!.getImageData(0,0,600,260).data;
   const rect=canvas.getBoundingClientRect();
   for(let y=258;y>=0;y-=2)for(let x=2;x<598;x+=2){
    const i=(y*600+x)*4;
    if(pixels[i]===189&&pixels[i+1]===130&&pixels[i+2]===84)
     return {x:rect.left+(x+5)/600*rect.width,y:rect.top+rect.height*.55};
   }
   return {};
  });
  if(!sample)break;
  if(sample.x!==undefined&&sample.y!==undefined)await page.mouse.move(sample.x,sample.y);
  await page.waitForTimeout(40);
 }
 await won(page,'chestnuts');
});

test('all twelve games permit retry, pause, resume and exit without receiving a gift',async({page})=>{
 test.setTimeout(120000);await enter(page);
 for(const id of ['moon','keychain','chestnuts','earphones','band','doll','chocolate','letter','notes','hat','labubu','mystery']){
  await start(page,id);const host=page.locator('#game-host');await host.getByRole('button',{name:'选项',exact:true}).click();await host.getByRole('button',{name:'重新开始',exact:true}).click();await host.getByRole('button',{name:'暂停',exact:true}).click();await expect(host.locator('.game-board')).toHaveClass(/paused/);await host.getByRole('button',{name:'继续',exact:true}).click();await expect(host.locator('.game-board')).not.toHaveClass(/paused/);await host.getByRole('button',{name:'先退出',exact:true}).click();await expect(host).toBeHidden();expect(await page.evaluate(value=>JSON.parse(localStorage.getItem('birthday-cottage-v2')!).opened.includes(value),id)).toBe(false);
 }
});


test.describe('phone touch controls',()=>{
 test.use({viewport:{width:390,height:844},hasTouch:true});

 test('all twelve games expose pause, retry and exit in the rotated phone viewport',async({page})=>{
  test.setTimeout(150000);
  await enter(page);
  for(const id of ['moon','keychain','chestnuts','earphones','band','doll','chocolate','letter','notes','hat','labubu','mystery']){
   await start(page,id);
   const game=page.locator('#game-host'), board=game.locator('.game-board');
   await game.getByRole('button',{name:'暂停',exact:true}).tap();
   await expect(board).toHaveClass(/paused/);
   await game.getByRole('button',{name:'继续',exact:true}).tap();
   await expect(board).not.toHaveClass(/paused/);
   await game.getByRole('button',{name:'选项',exact:true}).tap();await game.getByRole('button',{name:'重新开始',exact:true}).tap();
   await game.getByRole('button',{name:'先退出',exact:true}).tap();
   await expect(game).toBeHidden();
  }
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('birthday-cottage-v2')!).opened)).toEqual([]);
 });

 test('claw uses touch coordinates and the drop button through all three rounds',async({page})=>{
  test.setTimeout(90000);
  await enter(page);
  await start(page,'doll');
  const game=page.locator('#game-host'), canvas=game.locator('canvas');
  const drop=game.getByRole('button',{name:'落爪 / 放下',exact:true});
  async function aim(x:number){
   await canvas.scrollIntoViewIfNeeded();
   const point=await canvas.evaluate((node:HTMLCanvasElement,x)=>{
    const bounds=node.getBoundingClientRect(),fraction=x/node.width;
    return document.getElementById('app')?.classList.contains('rotated')
     ? {x:bounds.left+bounds.width/2,y:bounds.top+bounds.height*fraction}
     : {x:bounds.left+bounds.width*fraction,y:bounds.top+bounds.height/2};
   },x);
   await page.touchscreen.tap(point.x,point.y);
  }
  for(const target of [300,400,220]){
   await aim(target);
   await drop.tap();
   await expect(game.locator('.game-status')).toContainText('抓到了',{timeout:10000});
   await aim(70);
   await drop.tap();
  }
  await won(page,'doll');
 });
});
