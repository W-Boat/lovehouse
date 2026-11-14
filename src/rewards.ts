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
  const stars=Array.from({length:130},(_,i)=>({x:((i*73.731)%1)*1280,y:((i*19.317)%1)*720,z:.25+(i%9)/10}));
  const caption=document.createElement('p');caption.className='wish-animation-caption';caption.setAttribute('role','status');caption.textContent='把愿望交给星光';host.append(caption);
  canvas.setAttribute('aria-label','星光正在带来礼物');
  const source=ctx.scene.textures.get('gift-'+gift.id).getSourceImage() as HTMLCanvasElement;
  const giftSources=all?config.gifts.map(item=>ctx.scene.textures.get('gift-'+item.id).getSourceImage() as HTMLCanvasElement):[];
  const sky=g.createRadialGradient(640,300,5,640,300,740);
  sky.addColorStop(0,'#49416a');sky.addColorStop(.5,'#1c2244');sky.addColorStop(1,'#0d152b');
  let phase=-1;
  let elapsed=0,last=performance.now(),finished=false;
  const complete=()=>{if(finished)return;finished=true;close();if(all){for(const item of config.gifts)unlockGift(save,item.id);persist();ctx.refresh();ctx.toast('十二份心意，已经全部珍藏。');return}
   const approach=()=>{const item=ctx.scene.getItem(gift.id);if(item)ctx.scene.approach(item,()=>ctx.openGift(gift.id));else ctx.toast('这份礼物暂时无法到达，请再试一次。')};
   if(ctx.scene.zone!=='room')void ctx.scene.transitionTo('room',approach);else approach();
  };skip.onclick=complete;
  function tick(now:number){
   if(finished||!layer)return;
   const dt=Math.min(.1,(now-last)/1000);last=now;
   if(!document.hidden)elapsed+=dt;
   const duration=save.reduced?.2:6.4,t=save.reduced?4.5:elapsed;
   const nextPhase=t<1.2?0:t<3.5?1:2;
   if(nextPhase!==phase){phase=nextPhase;caption.textContent=phase===0?'把愿望交给星光':phase===1?'有一份心意，正向你靠近':all?'所有心意，都为你而来':gift.name+' · '+gift.subtitle}
   g.fillStyle=sky;g.fillRect(0,0,1280,720);
   for(const star of stars){
    const travel=save.reduced?1:1+Math.min(2.5,Math.max(0,t-1.2))*star.z*.45;
    const x=640+(star.x-640)*travel,y=300+(star.y-300)*travel;
    g.globalAlpha=.3+.45*Math.sin(t+star.x)**2;
    g.fillStyle='#e9e7ff';g.fillRect(Math.round(x),Math.round(y),2+star.z,2+star.z);
   }
   g.globalAlpha=1;
   const reveal=Math.max(0,Math.min(1,(t-3.1)/1.4));
   const eased=reveal*reveal*(3-2*reveal);
   if(t<3.7&&!save.reduced){
    const progress=Math.min(1,t/3.2),x=140+500*progress,y=30+270*progress;
    g.save();g.globalCompositeOperation='lighter';
    for(let i=0;i<5;i++){
     g.lineWidth=20-i*4;g.strokeStyle='rgba(255,215,154,'+(.14+i*.10)+')';
     g.beginPath();g.moveTo(x-200,y-155);g.quadraticCurveTo(x-80,y-15,x,y);g.stroke();
    }
    g.translate(x,y);g.rotate(t*.5);
    g.fillStyle='#fff3ce';g.beginPath();g.moveTo(0,-25);g.lineTo(7,-7);g.lineTo(25,0);g.lineTo(7,7);g.lineTo(0,25);g.lineTo(-7,7);g.lineTo(-25,0);g.lineTo(-7,-7);g.closePath();g.fill();g.restore();
   }
   if(reveal>0){
    g.save();g.globalAlpha=eased;
    g.strokeStyle='#d8b880';g.lineWidth=2;
    for(let ring=0;ring<2;ring++){
     const radius=130+ring*30+(1-eased)*80;
     g.beginPath();g.arc(640,295,radius,0,Math.PI*2);g.stroke();
    }
    if(all){
     const count=config.gifts.length;
     for(let i=0;i<count;i++){
      const a=i*Math.PI*2/count-Math.PI/2;
      const image=giftSources[i];
      const size=64;
      g.drawImage(image,640+Math.cos(a)*220-size/2,295+Math.sin(a)*220-size/2,size,size);
     }
    }
    const size=155+(1-eased)*45;
    g.imageSmoothingEnabled=false;
    g.drawImage(source,640-size/2,295-size/2,size,size);
    g.fillStyle='#ffe7ac';g.fillRect(580,425,120,2);g.restore();
   }
   if(elapsed>=duration){complete();return}
   animation=requestAnimationFrame(tick);
  }
  animation=requestAnimationFrame(tick);
 }
 document.addEventListener('open-wishes',wishes);document.addEventListener('open-achievements',achievementPanel);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&layer){event.stopImmediatePropagation();close()}},true);
 const tools=document.querySelector('.hud-tools')!;
 for(const [label,id,fn]of [['许愿','wishes',wishes],['成就','achievements',achievementPanel]] as const){const b=document.createElement('button');b.id=id;b.className='icon-button';b.title=label;b.setAttribute('aria-label',label);const img=document.createElement('img');img.src=assetUrl('favicon.webp');img.alt='';img.className='pixel-icon';b.append(img);b.onclick=fn;if(id==='wishes'){
  b.classList.add('wish-toolbar-button');
  document.querySelector('.place-plaque')!.append(b);
 }else tools.append(b)}
 document.addEventListener('unlock-everything',()=>{if(!save.cheat||!ctx.canUse())return;for(const gift of config.gifts)unlockGift(save,gift.id);save.visited=Object.keys(worlds);save.moments=[...new Set([...save.moments,...Object.values(worlds).flatMap(w=>w.items.map(i=>i.id))])];persist();ctx.refresh();ctx.toast('所有地图、互动与礼物已解锁。')});
 window.setInterval(()=>{if(!ctx.scene.entered)return;for(const a of achievements)if(a.check(save)&&!seen.has(a.id)){seen.add(a.id);const toast=document.createElement('div');toast.className='achievement-toast';toast.textContent='成就达成 · '+a.name;document.getElementById('app')!.append(toast);setTimeout(()=>toast.remove(),4000);break}},1600);
 return {close};
}
