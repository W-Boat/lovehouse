import type {Cottage} from './scene';
import {save,persist} from './state';
import {achievements,unlockGift} from './reward-progress';
import {birthdayConfig as config,type GiftId} from '../content/birthday-config';
import {worlds} from './world';
import {assetUrl} from './assets';
type Context={scene:Cottage;canUse:()=>boolean;close:()=>void;openGift:(id:GiftId)=>void;refresh:()=>void;toast:(s:string)=>void};
export function installRewards(ctx:Context){
 let layer:HTMLElement|undefined,animation=0;
 const seen=new Set(achievements.filter(a=>a.check(save)).map(a=>a.id));
 function close(){cancelAnimationFrame(animation);animation=0;layer?.remove();layer=undefined;ctx.scene.blocked=false}
 function panel(title:string){close();ctx.close();ctx.scene.stop();ctx.scene.blocked=true;layer=document.createElement('section');layer.className='stellar-panel';layer.setAttribute('role','dialog');layer.setAttribute('aria-label',title);layer.innerHTML='<button class="stellar-close" aria-label="返回小屋">×</button><header><small>UID:5201314</small><h2></h2></header><div class="stellar-content"></div>';layer.querySelector('h2')!.textContent=title;layer.querySelector('button')!.onclick=close;document.getElementById('app')!.append(layer);return layer.querySelector<HTMLElement>('.stellar-content')!}
 function achievementPanel(){if(!ctx.canUse())return;const host=panel('旅途中的成就');host.classList.add('achievement-list');for(const a of achievements){const node=document.createElement('article'),earned=a.check(save);node.className=earned?'earned':'';const title=document.createElement('h3'),text=document.createElement('p'),state=document.createElement('small');title.textContent=a.name;text.textContent=a.text;state.textContent=earned?'已达成':'等待我们的下一步';node.append(title,text,state);host.append(node)}}
 function wishes(){if(!ctx.canUse())return;const host=panel('把星辰赠予你');host.innerHTML='<div class="wish-orbit" aria-hidden="true">✦</div><p>每一道星光，都会带你走向一份心意。</p><p class="wish-count"></p><div class="wish-actions"><button class="primary" id="wish-one">单抽 · 去见礼物</button><button class="primary" id="wish-all">全抽 · 珍藏全部</button></div>';host.querySelector('.wish-count')!.textContent=`尚有 ${config.gifts.length-save.opened.length} 份未拆礼物 · 无消耗 · 无重复`;const one=host.querySelector<HTMLButtonElement>('#wish-one')!,all=host.querySelector<HTMLButtonElement>('#wish-all')!;one.disabled=all.disabled=save.opened.length===config.gifts.length;one.onclick=()=>draw(false);all.onclick=()=>draw(true)}
 function draw(all:boolean){
  const available=config.gifts.filter(g=>!save.opened.includes(g.id));if(!available.length)return;
  const gift=available[Math.floor(Math.random()*available.length)];
  const host=layer!.querySelector<HTMLElement>('.stellar-content')!;host.replaceChildren();const canvas=document.createElement('canvas'),skip=document.createElement('button');skip.textContent=save.reduced?'领取礼物':'跳过动画';skip.className='wish-skip secondary';host.append(canvas,skip);canvas.width=1280;canvas.height=720;const g=canvas.getContext('2d')!;
  const stars=Array.from({length:170},(_,i)=>({x:((i*73.731)%1)*1280,y:((i*19.317)%1)*720,z:.25+(i%9)/10}));
  let elapsed=0,last=performance.now(),finished=false;
  const complete=()=>{if(finished)return;finished=true;close();if(all){for(const item of config.gifts)unlockGift(save,item.id);persist();ctx.refresh();ctx.toast('十二份心意，已经全部珍藏。');return}
   const approach=()=>{const item=ctx.scene.getItem(gift.id);if(item)ctx.scene.approach(item,()=>ctx.openGift(gift.id));else ctx.toast('这份礼物暂时无法到达，请再试一次。')};
   if(ctx.scene.zone!=='room')void ctx.scene.transitionTo('room',approach);else approach();
  };skip.onclick=complete;
  function tick(now:number){if(finished||!layer)return;const dt=Math.min(.1,(now-last)/1000);last=now;if(!document.hidden)elapsed+=dt;const t=elapsed,duration=save.reduced ? .2 : 5.8;g.clearRect(0,0,1280,720);const glow=g.createRadialGradient(640,330,10,640,330,700);glow.addColorStop(0,t>3?'#fff0ccbd':'#7684bd7a');glow.addColorStop(.5,'#30245890');glow.addColorStop(1,'#0b183333');g.fillStyle=glow;g.fillRect(0,0,1280,720);
   for(const star of stars){const d=1+Math.max(0,t-1)*star.z*.65,x=640+(star.x-640)*d,y=330+(star.y-330)*d;g.fillStyle=`rgba(255,235,190,${.35+.5*Math.sin(t*2+star.x)**2})`;g.fillRect(x,y,2+star.z,2+star.z);if(t>1&&t<3){g.strokeStyle='#c3d9ff66';g.beginPath();g.moveTo(x,y);g.lineTo(x-(x-640)*.05,y-(y-330)*.05);g.stroke()}}
   const rise=Math.min(1,t/2.6),x=200+440*rise,y=70+260*rise;g.save();g.globalCompositeOperation='lighter';for(let i=0;i<6;i++){g.strokeStyle=`rgba(255,${175+i*10},${115+i*12},${.8-i*.1})`;g.lineWidth=18-i*3;g.beginPath();g.moveTo(x-160,y-120);g.quadraticCurveTo(x-75,y-20,x,y);g.stroke()}g.translate(x,y);g.rotate(t*.8);for(let i=0;i<8;i++){g.rotate(Math.PI/4);g.fillStyle='#fff4ce';g.beginPath();g.moveTo(0,-(i%2?12:28));g.lineTo(5,0);g.lineTo(0,10);g.lineTo(-5,0);g.fill()}g.restore();
   if(t>2.7){const p=Math.min(1,(t-2.7)/1.3);g.save();g.globalAlpha=p;for(let i=0;i<32;i++){const a=i*Math.PI/16+t*.1;g.strokeStyle=i%2?'#ffe7b644':'#d8b4f844';g.lineWidth=2;g.beginPath();g.moveTo(640+Math.cos(a)*60,330+Math.sin(a)*60);g.lineTo(640+Math.cos(a)*(160+p*450),330+Math.sin(a)*(160+p*450));g.stroke()}g.strokeStyle='#f8d899';g.lineWidth=2;g.beginPath();g.arc(640,330,90+p*28,0,Math.PI*2);g.stroke();g.font='28px CottagePixel';g.textAlign='center';g.fillStyle='#fff1c8';g.fillText(all?'十二道星光，都是你的':gift.name,640,510);g.restore()}
   if(t>=duration){complete();return}animation=requestAnimationFrame(tick)
  }animation=requestAnimationFrame(tick);
 }
 document.addEventListener('open-wishes',wishes);document.addEventListener('open-achievements',achievementPanel);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&layer){event.stopImmediatePropagation();close()}},true);
 const tools=document.querySelector('.hud-tools')!;
 for(const [label,id,fn]of [['许愿','wishes',wishes],['成就','achievements',achievementPanel]] as const){const b=document.createElement('button');b.id=id;b.className='icon-button';b.title=label;b.setAttribute('aria-label',label);const img=document.createElement('img');img.src=assetUrl('favicon.webp');img.alt='';img.className='pixel-icon';b.append(img);b.onclick=fn;if(id==='wishes'){b.classList.add('wish-shortcut');b.textContent=label;tools.parentElement!.append(b)}else tools.append(b)}
 document.addEventListener('unlock-everything',()=>{if(!save.cheat||!ctx.canUse())return;for(const gift of config.gifts)unlockGift(save,gift.id);save.visited=Object.keys(worlds);save.moments=[...new Set([...save.moments,...Object.values(worlds).flatMap(w=>w.items.map(i=>i.id))])];persist();ctx.refresh();ctx.toast('所有地图、互动与礼物已解锁。')});
 window.setInterval(()=>{if(!ctx.scene.entered)return;for(const a of achievements)if(a.check(save)&&!seen.has(a.id)){seen.add(a.id);const toast=document.createElement('div');toast.className='achievement-toast';toast.textContent='成就达成 · '+a.name;document.getElementById('app')!.append(toast);setTimeout(()=>toast.remove(),4000);break}},1600);
 return {close};
}
