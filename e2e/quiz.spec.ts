import {expect,test} from '@playwright/test';

test('two players publish, score and receive the same quiz outcomes',async({browser,baseURL})=>{
 const hostContext=await browser.newContext({baseURL});
 const guestContext=await browser.newContext({baseURL});
 try{
  const host=await hostContext.newPage(),guest=await guestContext.newPage();
  await Promise.all([host,guest].map(async page=>{
   await page.goto('/');
   await page.locator('#custom-save').click({timeout:45000});
   await page.locator('#online-toggle').click();
   await page.getByLabel('服务器地址（留空使用默认）').fill('ws://127.0.0.1:8787/online');
  }));
  await host.getByRole('button',{name:'创建双人房间',exact:true}).click();
  const room=host.locator('#online-room-info');
  await expect(host.locator('#online-status')).toContainText('已连接双人房间');
  const roomCode=/^房间 (\S+) ·/;
  await expect(room).toHaveText(roomCode);
  await guest.getByLabel('房间号',{exact:true}).fill((await room.innerText()).match(roomCode)![1]);
  await guest.getByRole('button',{name:'加入房间',exact:true}).click();
  const h=host.locator('.online-quiz'),g=guest.locator('.online-quiz');
  await expect(h.getByLabel('这局题数').locator('option')).toHaveText(['5','10','15','20']);
  await g.getByRole('button',{name:'邀请对方答题'}).click();
  await h.getByRole('button',{name:'接受问答'}).click();
  for(let i=0;i<5;i++){
   const draft=g.locator('fieldset').nth(i);
   await draft.getByLabel('题目').fill('我喜欢什么？');
   await draft.getByLabel('选项 A').fill('小猫');
   await draft.getByLabel('选项 B').fill('星星');
   await draft.getByLabel('选项 C').fill('栗子');
   await draft.getByLabel('正确答案').selectOption('1');
  }
  await g.getByRole('button',{name:'发布全部题目'}).click();
  await h.getByRole('button',{name:'A · 小猫'}).click();
  await expect(h.locator('.quiz-penalty')).toBeVisible();
  await expect(g.locator('.quiz-penalty')).toBeVisible();
  await expect(h.getByRole('button',{name:'继续',exact:true})).toBeDisabled();
  await h.getByRole('button',{name:'继续',exact:true}).click();
  for(let i=1;i<5;i++){
   await h.getByRole('button',{name:'B · 星星'}).click();
   await expect(g.locator('.quiz-reward')).toBeVisible();
   await h.getByRole('button',{name:'继续',exact:true}).click();
  }
  for(const [page,panel] of [[host,h],[guest,g]] as const){
   await expect(panel).toContainText('这一局答对 4 / 5 题');
   const save=await page.evaluate(()=>JSON.parse(localStorage.getItem('birthday-cottage-v2')!));
   expect(save.quizStars).toBe(4);
   expect(save.inventory).toContain('quiz-heart');
  }
 }finally{await Promise.all([hostContext.close(),guestContext.close()])}
});
