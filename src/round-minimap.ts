import type {Cottage} from './scene';
import {save} from './state';
import {worlds,type Item} from './world';

/** Nearby overview is deliberately separate from the world/fast-travel map. */
export function minimapIcon(item:Item){return item.to?'ui-sign':item.kind==='collect'?'ui-bag':item.kind==='slot'?'ui-flower':item.action?.includes('坐')?'ui-home':item.id.startsWith('gift-')?'ui-bag':'ui-wand'}
export function installRoundMinimap(scene:Cottage,openWorld:()=>void){
 const button=document.createElement('button');button.id='round-minimap';button.type='button';button.title='附近的小地图 · 点击打开世界地图';button.setAttribute('aria-label',button.title);
 const canvas=document.createElement('canvas');canvas.width=192;canvas.height=192;canvas.setAttribute('aria-hidden','true');button.append(canvas);document.getElementById('game-hud')!.append(button);
 const g=canvas.getContext('2d')!;let last=0,previousGirl={x:0,y:0},direction={x:0,y:1},frame=0;
 button.onclick=()=>{if(scene.entered&&!scene.transitioning)openWorld()};
 function refresh(){button.hidden=!save.settings.minimap;document.body.classList.toggle('has-round-minimap',save.settings.minimap)}
 function picture(key:string,x:number,y:number,size:number){if(!scene.textures.exists(key))return;const source=scene.textures.get(key).getSourceImage() as HTMLImageElement;const r=size/Math.max(source.width,source.height);g.drawImage(source,x-source.width*r/2,y-source.height*r/2,source.width*r,source.height*r)}
 function draw(time:number){
  frame=requestAnimationFrame(draw);if(time-last<100||button.hidden||!scene.entered||document.hidden)return;last=time;
  const p=scene.player;if(!p)return;const dx=p.x-previousGirl.x,dy=p.y-previousGirl.y;if(Math.hypot(dx,dy)>.5)direction={x:dx,y:dy};previousGirl={x:p.x,y:p.y};
  const scale=.65,pos=(x:number,y:number)=>({x:96+(x-p.x)*scale,y:96+(y-p.y)*scale});
  g.clearRect(0,0,192,192);g.save();g.beginPath();g.arc(96,96,88,0,Math.PI*2);g.clip();g.imageSmoothingEnabled=false;g.fillStyle='#383b40';g.fillRect(0,0,192,192);
  const world=worlds[scene.zone],back=pos(0,0);scene.drawEnvironment(g,back.x,back.y,640*scale,426.667*scale);
  g.fillStyle='#231c3540';g.fillRect(0,0,192,192);
  for(const item of world.items){const point=pos(item.x,item.y);if(Math.hypot(point.x-96,point.y-96)>77)continue;g.fillStyle='#f5dfb8ee';g.beginPath();g.arc(point.x,point.y,9,0,Math.PI*2);g.fill();picture(minimapIcon(item),point.x,point.y,13)}
  const buddy=pos(scene.boy.x,scene.boy.y),boy=scene.poseSource('boy',0);if(boy){const r=25/Math.max(boy.width,boy.height);g.drawImage(boy,buddy.x-boy.width*r/2,buddy.y-boy.height*r, boy.width*r,boy.height*r)}
  g.fillStyle='#f9d7a2';g.beginPath();g.arc(96,96,14,0,Math.PI*2);g.fill();const source=scene.poseSource('girl',0);if(source){const r=26/Math.max(source.width,source.height);g.drawImage(source,96-source.width*r/2,96-source.height*r/2,source.width*r,source.height*r)}
  const a=Math.atan2(direction.y,direction.x);g.save();g.translate(96,96);g.rotate(a);g.fillStyle='#fff6ce';g.beginPath();g.moveTo(24,0);g.lineTo(16,-5);g.lineTo(16,5);g.closePath();g.fill();g.restore();g.restore();
  g.strokeStyle='#65462f';g.lineWidth=8;g.beginPath();g.arc(96,96,90,0,Math.PI*2);g.stroke();g.strokeStyle='#e5bb7f';g.lineWidth=3;g.beginPath();g.arc(96,96,86,0,Math.PI*2);g.stroke();
 }
 refresh();frame=requestAnimationFrame(draw);window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);frame=0});window.addEventListener('pageshow',()=>{if(!frame)frame=requestAnimationFrame(draw)});return{refresh};
}
