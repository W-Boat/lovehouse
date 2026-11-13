import type {Cottage} from './scene';
import {worlds} from './world';
import {save} from './state';
import {setAmbience} from './audio';
import {films,filmMoment,concertSection,rideProgress,type FilmId} from '../content/films';
import personal from '../content/personal.json';
/** Original frame-based shorts. Playback never moves the actors in the live world. */
export function playCinema(id:string,host:HTMLElement,scene:Cottage,done:()=>void){
 let disposed=false,paused=false,ended=false,time=0,last=0,raf=0,affection=false;
 const concert=id==='concert',ride=id==='ferris',filmId=(id in films?id:'meet') as FilmId,spec=films[filmId],duration=concert?90:ride?60:spec.duration;
 const controls=document.createElement('div');controls.className='modal-actions';const title=document.createElement('h2');title.id='modal-title';title.textContent=concert?'火星 · 今晚为你亮起':ride?'和你一起，慢慢升高':spec.title;
 const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;canvas.className='film-canvas';canvas.setAttribute('role','img');canvas.setAttribute('aria-label',title.textContent+'，原创像素动画');host.replaceChildren(title,canvas,controls);
 const controller=new AbortController();const button=(label:string,run:()=>void)=>{const b=document.createElement('button');b.className='secondary';b.textContent=label;b.addEventListener('click',run,{signal:controller.signal});controls.append(b);return b};
 const pause=button('暂停',()=>{if(ended)return;paused=!paused;pause.textContent=paused?'继续':'暂停'});button('从头播放',()=>{time=0;last=0;ended=false;paused=false;pause.textContent='暂停'});button('结束放映',done);
 if(ride)button('把肩膀借给你',()=>affection=!affection);if(concert)button('一起举起应援棒',()=>affection=!affection);setAmbience(concert?'mars':'cinema');
 const photos:HTMLImageElement[]=[];for(const path of personal.memoryPhotos as string[]){const img=new Image();img.src=new URL('../'+path,import.meta.url).href;photos.push(img)}
 const g=canvas.getContext('2d')!;g.imageSmoothingEnabled=false;
 const smooth=(v:number)=>{const x=Math.max(0,Math.min(1,v));return x*x*(3-2*x)};
 const texture=(key:string)=>scene.textures.exists(key)?scene.textures.get(key).getSourceImage() as HTMLCanvasElement:undefined;
 const draw=(source:CanvasImageSource|undefined,x:number,y:number,h:number)=>{if(!source)return;const s=source as HTMLCanvasElement;g.drawImage(source,x-h*s.width/s.height/2,y-h,h*s.width/s.height,h)};
 const actor=(who:'girl'|'boy',x:number,y:number,pose=0,h=96,walking=false,dir=3)=>{const api=scene as Cottage&{walkingSource?:(w:'girl'|'boy',d:number,p:number)=>HTMLCanvasElement|undefined};const phase=save.reduced?0:Math.floor(time*7)%4;draw(walking?(api.walkingSource?.(who,dir,phase)??texture(who+'-stride-'+(dir*4+phase))):scene.poseSource(who,pose),x,y,h)};
 const pair=(frame:number,x:number,y:number,h=112,holding=false)=>{const api=scene as Cottage&{coupleSource?:(i:number,h?:boolean)=>HTMLCanvasElement|undefined};draw(api.coupleSource?.(frame,holding)??texture((holding?'holding-art-':'pair-art-')+frame),x,y,h)};
 const background=(zone:keyof typeof worlds)=>{const source=texture(worlds[zone].texture);g.fillStyle='#253942';g.fillRect(0,0,960,540);if(source)g.drawImage(source,0,0,960,540)};
 const caption=(line:string)=>{g.fillStyle='#191c29ee';g.fillRect(28,455,904,61);g.fillStyle='#ffedd0';g.font='23px CottagePixel';g.textAlign='center';g.fillText(line,480,493,858)};
 const particles=(count:number,color:string)=>{if(save.reduced)return;g.fillStyle=color;for(let i=0;i<count;i++)g.fillRect((i*137+time*13)%960,90+(i*43)%300+Math.sin(time+i)*10,3,3)};
 const film=()=>{
  const m=filmMoment(filmId,time),{shot,local,progress}=m,p=smooth(progress),moving=local<7;
  g.save();const zoom=save.reduced?shot.scale:shot.scale+.035*p;g.translate(480,255);g.scale(zoom,zoom);g.translate(-480,-255);background(shot.zone);
  const x=save.reduced?430:290+180*smooth(local/7),y=352;
  switch(shot.action){
   case 'arrive':actor('girl',save.reduced?440:150+290*smooth(local/8),y,0,96,moving,3);actor('boy',540,y,0);break;
   case 'greet':actor('girl',435,y,local<2?0:local<9?8:0);actor('boy',525,y,local<3?0:local<9?8:0);break;
   case 'flower':pair(local<2?8:local<4?9:local<9?9:8,480,y,112);break;
   case 'hug':pair(local<2?0:local<4?1:local<9?2:local<10?1:0,480,y,112);break;
   case 'walk':case 'leave':pair(12+(save.reduced?0:Math.floor(time*7)%4),save.reduced?480:230+450*p,y,108,true);break;
   case 'pack':actor('boy',490,y,local<3?0:local<9?9:0);actor('girl',405,y,0);draw(texture('prop-4'),470,y-35,26);break;
   case 'fireflies':actor('girl',440,y,local>3&&local<9?8:0);actor('boy',520,y,0);particles(24,'#ddf8a0');break;
   case 'boat':actor('girl',450,y,local>2&&local<7?9:0);actor('boy',520,y,0);g.fillStyle='#f5dfb7';g.beginPath();const bx=530+90*p,by=365+40*p;g.moveTo(bx-12,by);g.lineTo(bx+12,by);g.lineTo(bx+5,by+8);g.lineTo(bx-5,by+8);g.closePath();g.fill();break;
   case 'rest':actor('girl',457,y,4);actor('boy',510,y,4);g.strokeStyle='#b58c65';g.lineWidth=8;g.beginPath();g.moveTo(405,y-26);g.lineTo(560,y-26);g.stroke();if(!save.reduced){g.fillStyle='#ffda9b';g.fillRect(480+Math.sin(time)*3,y-130,3,3)}break;
   case 'decorate':actor('boy',x,y,0,96,moving,3);actor('girl',560,y,9);for(let i=0;i<9;i++){g.fillStyle=i%2?'#e89aab':'#f9dea3';g.fillRect(290+i*45,130+(i%2)*8,14,19)}break;
   case 'light':actor('boy',480,y,local<2?0:local<8?8:0);g.fillStyle=`rgba(255,211,136,${.04+.12*smooth(local/4)})`;g.fillRect(0,0,960,540);break;
   case 'surprise':actor('boy',550,y,8);actor('girl',save.reduced?430:180+250*smooth(local/7),y,0,96,moving,3);particles(20,'#f3b5ca');break;
   case 'wish':actor('girl',450,y,0);actor('boy',525,y,0);draw(texture('cake'),480,y-30,85);if(local>3&&local<10){g.fillStyle='#19172366';g.fillRect(0,0,960,540);g.fillStyle='#ffda83';for(let i=0;i<3;i++)g.fillRect(465+i*14,239,3,8)}break;
   case 'celebrate':pair(local<2?0:local<4?1:local<9?2:1,480,y,112);particles(32,'#ffdaaa');break;
  }
  const photo=photos[m.index%Math.max(1,photos.length)];if(photo?.complete&&photo.naturalWidth&&shot.action==='pack'){g.fillStyle='#f3dfbe';g.fillRect(640,145,160,120);const r=Math.min(144/photo.width,104/photo.height);g.drawImage(photo,720-photo.width*r/2,205-photo.height*r/2,photo.width*r,photo.height*r)}
  g.restore();caption(shot.line);
  // Brief dark shutter marks an intentional scene cut; no white flash.
  if(!save.reduced){const fade=Math.max(0,1-local/.45,1-(shot.seconds-local)/.45);if(fade>0){g.fillStyle=`rgba(15,19,30,${fade})`;g.fillRect(0,0,960,540)}}
 };
 const showConcert=()=>{const section=concertSection(time),motion=save.reduced?0:time,climax=section==='climax';background('mars');
  if(section!=='countdown'&&section!=='curtain')for(let i=0;i<6;i++){g.fillStyle=climax?'#edb0ca35':'#f6dca320';g.beginPath();g.moveTo(230+i*95,90);g.lineTo(100+i*90+Math.sin(motion*.5+i)*55,400);g.lineTo(250+i*95+Math.sin(motion*.5+i)*55,400);g.closePath();g.fill()}
  const performing=['opening','verse','climax'].includes(section);actor('boy',480+(save.reduced?0:Math.sin(time*.7)*8),260,section==='bow'?9:performing?12+(save.reduced?0:Math.floor(time*(climax?6:3))%4):0,114);
  actor('girl',355,430,affection?15:12);actor('boy',408,430,affection?15:0);for(let i=0;i<32;i++){g.fillStyle=i%2?'#ff8fbc':'#fff0b6';g.fillRect(35+i*28,505+Math.sin(motion*(climax?3:1.5)+i)*8,4,18)}
  caption(section==='countdown'?`演出即将开始 · ${Math.max(1,6-Math.floor(time))}`:section==='opening'?'第一束灯光亮了。今晚，陪你听到最后。':section==='verse'?'不必急着记录，先好好听这一段。':section==='climax'?'把应援棒举起来，这一刻一起发光。':section==='bow'?'谢谢你，把今晚留给了这里。':'灯慢慢暗下来，心里的声音还在。');
 };
 const showRide=()=>{background('ferris');const progress=save.reduced?.5:rideProgress(time),angle=Math.PI/2+Math.PI*2*progress,cx=480,cy=245,r=175;
  g.strokeStyle='#f0ce8e';g.lineWidth=6;g.beginPath();g.arc(cx,cy,r,0,Math.PI*2);g.stroke();for(let i=0;i<8;i++){const a=angle+i*Math.PI/4;g.beginPath();g.moveTo(cx,cy);g.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);g.stroke()}
  g.beginPath();g.moveTo(400,444);g.lineTo(cx,cy);g.lineTo(560,444);g.stroke();const x=cx+Math.cos(angle)*r,y=cy+Math.sin(angle)*r;
  // Cabin stays upright while the wheel turns; sill occludes seated lower legs.
  g.fillStyle='#49323f';g.fillRect(x-62,y-60,124,100);actor('girl',x-24,y+20,affection?10:4,70);actor('boy',x+23,y+20,4,70);g.fillStyle='#b66f83';g.fillRect(x-66,y+7,132,35);g.strokeStyle='#ffe7bb';g.lineWidth=5;g.strokeRect(x-66,y-62,132,104);
  caption(time<5?'坐稳了吗？我们慢慢出发。':time<25?'一点点升高，街灯变成小小的星星。':time<35?'到最高处了。想说的话，可以慢慢说。':time<55?'把肩膀借给你，再一起回到地面。':'到站了。下次，还坐你旁边。');
 };
 const tick=(now:number)=>{if(disposed)return;const dt=last?Math.min(.1,(now-last)/1000):0;last=now;if(!paused)time=Math.min(duration,time+dt);g.fillStyle='#151a2b';g.fillRect(0,0,960,540);concert?showConcert():ride?showRide():film();if(time>=duration){ended=true;paused=true;pause.textContent='已放映完毕';g.fillStyle='#151a2bce';g.fillRect(0,0,960,540);g.fillStyle='#ffe7c0';g.font='30px CottagePixel';g.textAlign='center';g.fillText('这一段，替你好好收着。',480,260)}raf=requestAnimationFrame(tick)};
 raf=requestAnimationFrame(tick);return()=>{if(disposed)return;disposed=true;cancelAnimationFrame(raf);controller.abort();setAmbience(scene.zone);canvas.remove()};
}
