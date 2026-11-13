import {save,persist} from './state';
import {beats,chooseCards,classify,rankOf,type Play} from './heartbeat-cards';

function node<K extends keyof HTMLElementTagNameMap>(tag:K,text='',className=''){
 const element=document.createElement(tag);
 element.textContent=text;
 element.className=className;
 return element;
}
function button(label:string,action:()=>void,disabled=false){
 const control=node('button',label,'secondary');
 control.type='button';control.disabled=disabled;control.onclick=action;
 return control;
}
function panel(host:HTMLElement,title:string){
 host.className='side-game';
 const heading=node('h2',title), status=node('p','','side-status'), board=node('div','','side-board'), controls=node('div','','side-controls');
 heading.id='modal-title';status.setAttribute('aria-live','polite');
 host.append(heading,status,board,controls);
 return {status,board,controls};
}

export function openSugarWorkshop(host:HTMLElement){
 const {status,board,controls}=panel(host,'糖葫芦制作车间');
 const recipes=[{name:'冰糖山楂',cost:3,price:7,heat:3,fruit:'●'},{name:'芝麻山楂',cost:4,price:9,heat:4,fruit:'◉'},{name:'双果糖葫芦',cost:5,price:12,heat:5,fruit:'◆'}];
 const day=save.workshop.day, initial=save.workshop.coins;
 let stove=save.workshop.stove,cash=initial, heat=0, fruit=0, phase='order', served=0, recipe=recipes[0], message='选一张订单。当天营业收入结算后会写入存档。';
 const orders=Array.from({length:3},(_,i)=>recipes[(day-1+i*(day%3===0?0:2))%recipes.length]);
 const cost=(r:typeof recipes[number])=>Math.max(1,r.cost-stove);
 function draw(){
  status.textContent='第 '+day+' 天 · '+cash+' 铜钱 · 已交单 '+served+'/3';
  board.replaceChildren(node('p',message),node('div',recipe.fruit.repeat(fruit),'sugar-skewer'));
  controls.replaceChildren();
  if(phase==='order'){
   for(const [index,r] of orders.entries())if(index>=served)controls.append(button(r.name+' · 成本 '+cost(r)+' · 售价 '+r.price,()=>{
    [orders[served],orders[index]]=[orders[index],orders[served]];
    recipe=r;cash-=cost(r);fruit=0;heat=0;phase='string';message='把三颗洗好的果子串上竹签。';draw();
   },cash<cost(r)));
   if(stove<2){const price=16+stove*12;controls.append(button('升级铜锅 · '+price+' 铜钱',()=>{cash-=price;stove++;message='新铜锅让每串少用一份糖。';draw()},cash<price))}
   controls.append(button('收摊结算',settle));
  }
  if(phase==='string')controls.append(button('串上一颗',()=>{fruit++;if(fruit===3){phase='heat';message='把糖浆调到 '+recipe.heat+' 格，再裹糖。'}draw()}));
  if(phase==='heat'){
   board.append(node('div','糖浆 '+('■'.repeat(heat))+'□'.repeat(6-heat),'sugar-heat'));
   controls.append(button('添火',()=>{heat++;draw()},heat===6),button('降火',()=>{heat--;draw()},heat===0),button('裹糖',()=>{
    if(heat!==recipe.heat){message=heat<recipe.heat?'糖衣太薄。再添一点火。':'糖浆偏热。先把火降下来。';draw();return}
    phase='cool';message='薄糖衣裹好了，放到架上晾凉。';draw();
   }));
  }
  if(phase==='cool')controls.append(button('晾凉装袋',()=>{phase='sell';message='糖衣脆了，可以交单。';draw()}));
  if(phase==='sell')controls.append(button('交单 +'+recipe.price,()=>{cash+=recipe.price;served++;fruit=0;phase=served===3?'done':'order';message=served===3?'三张订单都交了。':'下一位客人来了。';draw()}));
  if(phase==='done')controls.append(button('收摊结算',settle));
  if(phase==='summary')controls.append(button('开始下一天',()=>{host.replaceChildren();openSugarWorkshop(host)}));
 }
 function settle(){
  if(phase==='summary')return;
  const profit=cash-initial, nextCash=Math.max(cash,12);
  save.workshop={day:Math.min(10000,day+1),coins:Math.min(100000,nextCash),best:Math.max(save.workshop.best,profit),stove};
  persist();phase='summary';
  message='今天交了 '+served+' 单，净收益 '+profit+' 铜钱。最高单日收益 '+save.workshop.best+'。'+(cash<12?' 明天有 12 铜钱的启动资金。':'');
  draw();
 }
 draw();
}

const rankLabels=['3','4','5','6','7','8','9','10','J','Q','K','A','2','小王','大王'];
function cardLabel(c:number){return c>=52?rankLabels[c-39]:rankLabels[rankOf(c)-3]+['♠','♥','♣','♦'][c%4]}
function openCards(host:HTMLElement){
 const {status,board,controls}=panel(host,'心跳斗地主');
 const names=['你','灯灯','山山'];
 let hands:number[][]=[],picked=new Set<number>(),landlord=0,turn=0,lead=0,passes=0,table:Play|undefined,history:string[]=[],winner=-1,bidding=true,bottom:number[]=[];
 function deal(){
  const deck=Array.from({length:54},(_,i)=>i);
  for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]]}
  hands=[deck.slice(0,17),deck.slice(17,34),deck.slice(34,51)].map(h=>h.sort((a,b)=>a-b));
  bottom=deck.slice(51);picked.clear();passes=0;table=undefined;history=[];winner=-1;bidding=true;draw();
 }
 function bid(seat:number){
  landlord=seat;turn=seat;lead=seat;hands[seat].push(...bottom);hands[seat].sort((a,b)=>a-b);
  bidding=false;history.push(names[seat]+'叫地主，底牌 '+bottom.map(cardLabel).join(' '));
  draw();schedule();
 }
 function move(cards:number[]){
  const play=classify(cards);
  if(cards.length){
   if(!play||!beats(play,table)||cards.some(c=>!hands[turn].includes(c)))return;
   hands[turn]=hands[turn].filter(c=>!cards.includes(c));table=play;lead=turn;passes=0;
   history.push(names[turn]+' · '+cards.map(cardLabel).join(' '));
   if(!hands[turn].length){winner=turn;if((winner===landlord)===(landlord===0)){save.cardsWins=Math.min(100000,save.cardsWins+1);persist()}}
  }else{
   if(!table)return;
   history.push(names[turn]+' · 不出');
   if(++passes===2){table=undefined;passes=0}
  }
  picked.clear();turn=table?(turn+1)%3:lead;draw();schedule();
 }
 function schedule(){
  if(bidding||winner>=0||turn===0)return;
  window.setTimeout(()=>{
   if(!host.isConnected||winner>=0||turn===0)return;
   const cards=table&&lead!==landlord&&turn!==landlord&&hands[lead].length<=3?[]:chooseCards(hands[turn],table);
   move(cards);
  },550);
 }
 function draw(){
  status.textContent=bidding?'17 张手牌，先决定叫不叫地主。':winner>=0?((winner===landlord)===(landlord===0)?'这一局你赢了。':'这一局对方赢了。')+' 累计胜场 '+save.cardsWins:names[landlord]+'是地主 · '+names[turn]+'出牌';
  board.replaceChildren(node('div',names.slice(1).map((n,i)=>n+' '+hands[i+1].length+' 张').join('　')));
  const log=node('div','','cards-log');for(const line of history.slice(-3))log.append(node('div',line));board.append(log);
  const hand=node('div','','cards-hand');
  for(const c of hands[0]){
   const b=button(cardLabel(c),()=>{if(picked.has(c))picked.delete(c);else picked.add(c);draw()},bidding||turn!==0||winner>=0);
   b.classList.add('playing-card');if(c===53||c<52&&c%2===1)b.classList.add('red');
   b.setAttribute('aria-pressed',String(picked.has(c)));hand.append(b);
  }
  board.append(hand);controls.replaceChildren();
  if(bidding){controls.append(button('叫地主',()=>bid(0)),button('不叫',()=>bid(Math.random()<.5?1:2)));return}
  if(winner>=0){controls.append(button('再来一局',deal));return}
  const active=turn===0, selected=classify([...picked]);
  controls.append(button('提示',()=>{picked=new Set(chooseCards(hands[0],table));draw()},!active),
   button('出牌',()=>move([...picked]),!active||!selected||!beats(selected,table)),
   button('不出',()=>move([]),!active||!table));
 }
 deal();
}

function openJump(host:HTMLElement,avatar:string){
 const {status,board,controls}=panel(host,'心跳跳一跳');
 const stage=node('div','','jump-stage'), current=node('div','','jump-platform jump-current'),next=node('div','','jump-platform jump-next');
 const actor=node('img','','jump-actor');actor.src=avatar;actor.alt='正在跳跃的像素小人';actor.draggable=false;
 const meter=node('div','','jump-meter'),cells=Array.from({length:16},()=>node('i'));
 meter.append(...cells);stage.append(current,next,actor);board.append(stage,meter);
 let distance=36,width=19,score=0,auto=false,busy=false,ended=false,start:number|undefined,frame=0;
 const control=node('button','按住蓄力','primary');control.type='button';
 const reduced=save.reduced;
 const automatic=button('自动跳：关',()=>{
  auto=!auto;automatic.textContent='自动跳：'+(auto?'开':'关');automatic.setAttribute('aria-pressed',String(auto));
  if(auto&&!busy&&!ended&&start===undefined)jump(distance+2);
 });
 automatic.setAttribute('aria-pressed','false');
 const restart=button('重来',()=>{host.replaceChildren();openJump(host,avatar)});
 controls.append(control,automatic,restart);
 function paint(x=0,lift=0,scale=1){
  actor.style.left=(16+x)+'%';actor.style.bottom=(23+lift)+'%';actor.style.transform='translateX(-50%) scaleY('+(reduced?1:scale)+')';
  next.style.left=(16+distance)+'%';next.style.width=width+'%';
  status.textContent=(ended?'踩空了 · ':'')+'分数 '+score+' · 最高 '+save.jumpBest;
 }
 function jump(length:number){
  if(busy||ended||!host.isConnected)return;
  busy=true;control.disabled=true;
  const from=performance.now(), success=Math.abs(length-distance)<=width/2-1;
  const animate=(now:number)=>{
   if(!host.isConnected||!stage.isConnected)return;
   const t=Math.min(1,(now-from)/(reduced?240:550));
   paint(length*t,Math.sin(Math.PI*t)*(reduced?22:48)-(success?0:Math.max(0,t-.7)*80),1+Math.sin(Math.PI*t)*.08);
   if(t<1){requestAnimationFrame(animate);return}
   busy=false;ended=!success;
   if(success){
    score+=Math.abs(length-distance)<3?2:1;
    if(score>save.jumpBest){save.jumpBest=score;persist()}
    distance=25+Math.random()*37;width=Math.max(10,20-score*.35);paint();control.disabled=false;
    if(auto)window.setTimeout(()=>{if(auto&&stage.isConnected)jump(distance+2)},410);
   }else paint(length,-28,.85);
  };
  requestAnimationFrame(animate);
 }
 const charge=(now:number)=>{
  if(start===undefined||!stage.isConnected)return;
  const energy=Math.min(1,(now-start)/900);
  cells.forEach((c,i)=>c.classList.toggle('filled',i<energy*16));
  paint(0,0,1-energy*.23);frame=requestAnimationFrame(charge);
 };
 function begin(){if(!busy&&!ended&&!auto&&start===undefined){start=performance.now();frame=requestAnimationFrame(charge)}}
 function release(cancel=false){
  if(start===undefined)return;
  const energy=Math.min(1,(performance.now()-start)/900);
  start=undefined;cancelAnimationFrame(frame);cells.forEach(c=>c.classList.remove('filled'));
  if(cancel){paint();return}
  jump(10+energy*65);
 }
 control.onpointerdown=e=>{if(!e.isPrimary||e.button!==0)return;control.setPointerCapture(e.pointerId);begin()};
 control.onpointerup=e=>{if(e.isPrimary)release()};
 control.onpointercancel=()=>release(true);
 control.onlostpointercapture=()=>release(true);
 control.onkeydown=e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();begin()}};
 control.onkeyup=e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();release()}};
 control.onblur=()=>release(true);
 paint();
}

export function openHeartbeat(host:HTMLElement,kind:'cards'|'jump',avatar:string){
 if(kind==='cards')openCards(host);else openJump(host,avatar);
}
