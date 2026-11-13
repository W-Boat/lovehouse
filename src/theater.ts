import {uiCopy,formatCopy} from '../content/ui-copy';
import type {Cottage} from './scene';
import {worlds} from './world';
import {save} from './state';
import {setAmbience} from './audio';
import {films,filmMoment,concertSection,type FilmId} from '../content/films';
import personal from '../content/personal.json';
/** Original frame-based shorts. Playback never moves the actors in the live world. */
export function playCinema(id:string,host:HTMLElement,scene:Cottage,done:()=>void,projection?:HTMLElement){
 let disposed=false,paused=false,ended=false,time=0,last=0,raf=0,affection=false;
 const concert=id==='concert',filmId=(id in films?id:'meet') as FilmId,spec=films[filmId],duration=concert?90:spec.duration;
 const controls=document.createElement('div');controls.className='modal-actions';const title=document.createElement('h2');title.id='modal-title';title.textContent=concert?uiCopy('theater.concert-title'):spec.title;
 const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;canvas.className='film-canvas';canvas.setAttribute('role','img');canvas.setAttribute('aria-label',formatCopy('theater.canvas-label',{title:title.textContent}));if(projection){title.removeAttribute('id');host.replaceChildren(title,controls);projection.append(canvas)}else host.replaceChildren(title,canvas,controls);
 const controller=new AbortController();const button=(label:string,run:()=>void)=>{const b=document.createElement('button');b.className='secondary';b.textContent=label;b.addEventListener('click',run,{signal:controller.signal});controls.append(b);return b};
 const pause=button(uiCopy('theater.pause'),()=>{
  if(ended)return;
  paused=!paused;last=0;
  pause.textContent=paused?uiCopy('theater.resume'):uiCopy('theater.pause');
  if(!paused)schedule();
 });
 button(uiCopy('theater.restart'),()=>{
  time=0;last=0;ended=false;paused=false;pause.disabled=false;
  pause.textContent=uiCopy('theater.pause');schedule();
 });
 button(uiCopy('theater.close'),done);
 document.addEventListener('visibilitychange',()=>{
  last=0;
  if(document.hidden){cancelAnimationFrame(raf);raf=0}
  else if(!paused)schedule();
 },{signal:controller.signal});
 if(concert)button(uiCopy('theater.cheer'),()=>affection=!affection);setAmbience(concert?'mars':'cinema');
 const photos:HTMLImageElement[]=[];for(const path of personal.memoryPhotos as string[]){const img=new Image();img.src=/^https:\/\//.test(path)?path:new URL('../'+path,import.meta.url).href;photos.push(img)}
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
  caption(section==='countdown'?formatCopy('theater.countdown',{seconds:Math.max(1,6-Math.floor(time))}):section==='opening'?uiCopy('theater.concert.opening'):section==='verse'?uiCopy('theater.concert.verse'):section==='climax'?uiCopy('theater.concert.climax'):section==='bow'?uiCopy('theater.concert.bow'):uiCopy('theater.concert.curtain'));
 };
 function schedule(){
  if(!disposed&&!raf&&!document.hidden)raf=requestAnimationFrame(tick);
 }
 function tick(now:number){
  raf=0;
  if(disposed||document.hidden)return;
  if(!paused&&last)time=Math.min(duration,time+Math.max(0,now-last)/1000);
  last=now;
  g.fillStyle='#151a2b';g.fillRect(0,0,960,540);
  if(concert)showConcert();else film();
  if(time>=duration){
   ended=true;paused=true;pause.disabled=true;
   pause.textContent=uiCopy('theater.completed');
   g.fillStyle='#151a2bce';g.fillRect(0,0,960,540);
   g.fillStyle='#ffe7c0';g.font='30px CottagePixel';g.textAlign='center';
   g.fillText(uiCopy('theater.end-card'),480,260);
  }
  if(!paused)schedule();
 }
 schedule();
 return()=>{
  if(disposed)return;
  disposed=true;cancelAnimationFrame(raf);controller.abort();setAmbience(scene.zone);canvas.remove();
 };
}
