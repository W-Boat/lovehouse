import type {Cottage} from './scene';
import {save,persist} from './state';
import {parseMusicConfig,validMusicTrack} from './music-config';
import {createHeoEngine,type HeoPlayer} from './heo-engine';
import {setExternalMusic} from './audio';
type Context={scene:Cottage;open:(html:string,kind?:string)=>void;close:()=>void;toast:(text:string)=>void;photo:()=>void;note:()=>void};
const esc=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function installMusicRoom(ctx:Context){
 let player:HeoPlayer|undefined,disposeEngine:(()=>void)|undefined,layer:HTMLElement|undefined,cover:HTMLImageElement|undefined,floor:HTMLElement|undefined,controls:HTMLElement|undefined;
 let frame=0,generation=0,current=-1,last=0,angle=0,speed=0,needleUntil=0,requestPlay=false,lastVolume=-1;
 const scene=ctx.scene,bounds=new WeakMap<HTMLElement,string>();
 const setText=(node:Element|null,value:string)=>{if(node&&node.textContent!==value)node.textContent=value};
 const status=(text:string)=>{const label=controls?.querySelector('.music-status');if(label)label.textContent=text};
 function stop(){document.body.classList.remove('music-room-active');generation++;cancelAnimationFrame(frame);frame=0;disposeEngine?.();disposeEngine=undefined;player=undefined;layer?.remove();layer=undefined;controls=undefined;floor=undefined;cover=undefined;current=-1;lastVolume=-1;setExternalMusic(false)}
 function play(){
  if(!player){requestPlay=true;status('唱片正在准备，准备好后请点一次播放。');return}
  if(!save.music){save.music=true;persist()}
  if(!player.audio.paused){player.pause();return}
  player.play();void player.audio.play().catch(()=>status('点一下播放键，就可以落针了。'));
 }
 function project(element:HTMLElement,x:number,y:number,w:number,h:number){const a=scene.project(x,y),b=scene.project(x+w,y+h),key=[a.x,a.y,b.x,b.y].join(':');if(bounds.get(element)===key)return;bounds.set(element,key);Object.assign(element.style,{left:a.x+'px',top:a.y+'px',width:(b.x-a.x)+'px',height:(b.y-a.y)+'px'})}
 function trackChanged(){
  if(!player||!cover)return;const track=player.list.audios[player.list.index];if(!track)return;
  current=player.list.index;needleUntil=performance.now()+1000;
  cover.hidden=false;cover.src=track.cover||new URL('assets/loading-cottage.webp',document.baseURI).href;cover.alt='正在播放：'+track.name;
  status(track.name+' · '+track.artist);controls!.querySelector<HTMLButtonElement>('[data-music="like"]')!.textContent=save.notes['music-favorite']===track.name?'已放进喜欢':'喜欢这首';
 }
 async function start(){
  stop();if(scene.zone!=='musicroom')return;const mine=generation;document.body.classList.add('music-room-active');setExternalMusic(true);
  layer=document.createElement('section');layer.className='music-scene-layer';layer.setAttribute('aria-label','两个人的唱片房');
  cover=document.createElement('img');cover.className='music-cover';cover.alt='待播放的唱片封面';cover.src=new URL('assets/loading-cottage.webp',document.baseURI).href;cover.onerror=()=>{if(!cover)return;const fallback=new URL('assets/loading-cottage.webp',document.baseURI).href;if(cover.src!==fallback)cover.src=fallback;else cover.hidden=true};
  floor=document.createElement('div');floor.className='music-floor'+(save.notes['music-projection']==='soft'?' soft':'');floor.innerHTML='<span class="lyric-previous"></span><strong class="lyric-current">把喜欢的歌，放给身边的人听</strong><span class="lyric-next">走近唱片机，或点下方播放</span>';
  const disc=document.createElement('div');disc.className='music-vinyl';disc.innerHTML='<svg viewBox="-80 -80 160 160" preserveAspectRatio="none" aria-hidden="true"><g><circle r="78" fill="#1e1a20" stroke="#b98d63" stroke-width="2"/>'+[25,32,39,46,53,60,67,73].map(r=>`<circle r="${r}" fill="none" stroke="#64534c" stroke-width=".7"/>`).join('')+'<path d="M-60 -42L-30 -13M33 26L60 47" stroke="#d3b188" opacity=".35" stroke-width="12"/><circle r="22" fill="#bc7e67"/><circle r="3" fill="#f5dbab"/></g></svg>';
  const arm=document.createElement('div');arm.className='music-needle';arm.innerHTML='<svg viewBox="0 0 120 80" preserveAspectRatio="none" aria-hidden="true"><path d="M105 13L76 21L30 65" fill="none" stroke="#553c25" stroke-width="9"/><path d="M105 10L76 18L30 62" fill="none" stroke="#e4bd79" stroke-width="5"/><circle cx="105" cy="12" r="10" fill="#b99054"/><path d="M24 58L38 64L32 74L18 69Z" fill="#e6b775"/></svg>';
  controls=document.createElement('nav');controls.className='music-room-controls';controls.setAttribute('aria-label','唱片控制');
  controls.innerHTML='<p class="music-status" role="status">唱片正在准备…</p><div><button data-music="previous" aria-label="上一首">上一首</button><button data-music="play">播放</button><button data-music="next" aria-label="下一首">下一首</button></div><div class="music-small-actions"><button data-music="list">歌单</button><button data-music="like">喜欢这首</button><button data-music="sit">坐下听</button></div>';
  layer.append(cover,disc,arm,floor,controls);document.getElementById('game-frame')!.append(layer);
  controls.addEventListener('pointerdown',event=>event.stopPropagation());
  controls.querySelectorAll<HTMLButtonElement>('[data-music]').forEach(button=>button.onclick=()=>{
   const action=button.dataset.music;if(action==='play')play();else if(action==='next'){needleUntil=performance.now()+1000;player?.skipForward()}else if(action==='previous'){needleUntil=performance.now()+1000;player?.skipBack()}else if(action==='list')playlist();else if(action==='sit')scene.approachById('music-seat');else if(action==='like'&&player){save.notes['music-favorite']=player.list.audios[player.list.index]?.name??'';persist();button.textContent='已放进喜欢';ctx.toast('下次来听，也记得这首歌。')}
  });
  const paint=(now:number)=>{
   if(mine!==generation||scene.zone!=='musicroom'||!layer)return;
   const dt=Math.min(.1,(now-(last||now))/1000);last=now;
   const playing=Boolean(player&&!player.audio.paused&&!document.hidden);
   speed+=(playing&&now>needleUntil?1-speed:-speed)*Math.min(1,dt*3);angle+=save.reduced?0:speed*dt*132;
   disc.querySelector('g')!.setAttribute('transform',`rotate(${angle})`);arm.classList.toggle('lifted',now<needleUntil||!playing);
   project(cover!,268,21,102,92);project(disc,236,115,147,50);project(arm,338,106,67,44);project(floor!,185,253,270,89);
   setText(controls!.querySelector('[data-music="play"]'),playing?'暂停':'播放');
   if(player){if(current!==player.list.index)trackChanged();if(!save.music&&!player.audio.paused)player.pause();if(lastVolume!==save.settings.musicVolume){lastVolume=save.settings.musicVolume;player.volume(lastVolume,false)}
    const lines=player.list.audios[player.list.index]?.lrc?(player.lrc?.current??[]):[],seconds=player.audio.currentTime;let i=-1;for(let n=0;n<lines.length;n++){if(lines[n][0]<=seconds)i=n;else break}
    const text=lines.length?(i>=0?lines[i][1]:'等待第一句歌词…'):'这张是纯音乐，听一会儿就好。';
    setText(floor!.querySelector('.lyric-current'),text);setText(floor!.querySelector('.lyric-previous'),i>0?lines[i-1][1]:'');setText(floor!.querySelector('.lyric-next'),lines.length?(lines[i+1]?.[1]??''):player.list.audios[player.list.index]?.name??'');
   }
   frame=requestAnimationFrame(paint);
  };frame=requestAnimationFrame(paint);
  try{const cleanup=await createHeoEngine(save.musicRoom,p=>{if(mine!==generation){p.destroy();return}player=p;player.volume(save.settings.musicVolume,false);player.on('listswitch',trackChanged);player.on('error',()=>status('这首暂时播不了，可以换一首或切到离线唱片。'));trackChanged();if(requestPlay){requestPlay=false;status('唱片准备好了，点播放就可以落针。')}},status);if(mine!==generation)cleanup();else disposeEngine=cleanup}catch(error){if(mine===generation)status(error instanceof Error?error.message:'唱片暂未准备好，请重新进房间试试。')}
 }
 function playlist(){
  if(!player){configure();return}
  const tracks=player.list.audios;
  ctx.open(`<h2 id="modal-title">今晚的唱片</h2><p>选一首，唱针会替你换好。${save.notes['music-favorite']?'上次喜欢：'+esc(save.notes['music-favorite']):''}</p><div class="record-track-list">${tracks.slice(0,200).map((track,i)=>`<button class="${i===player!.list.index?'primary':'secondary'}" data-track="${i}">${esc(track.name)}<small>${esc(track.artist)}</small></button>`).join('')}</div><div class="modal-actions"><button class="secondary" id="record-config">配置歌单 / 音源</button></div>`,'music-list');
  document.querySelectorAll<HTMLButtonElement>('[data-track]').forEach(button=>button.onclick=()=>{const index=Number(button.dataset.track);ctx.close();needleUntil=performance.now()+1000;player?.list.switch(index);player?.play()});
  document.getElementById('record-config')!.onclick=configure;
 }
 function configure(){
  const c=save.musicRoom;
  ctx.open(`<h2 id="modal-title">唱片与歌单</h2><p>使用 HeoMusic 的 APlayer / Meting 内核。在线歌单和网络直链需要联网；内置两张唱片随客户端保存。</p><label>播放来源<select id="record-mode"><option value="offline" ${c.mode==='offline'?'selected':''}>内置唱片 / 自选音源</option><option value="online" ${c.mode==='online'?'selected':''}>HeoMusic 在线歌单</option></select></label><label>音乐平台<select id="record-server">${['tencent','netease','kugou'].map(v=>`<option value="${v}" ${v===c.server?'selected':''}>${{tencent:'QQ 音乐',netease:'网易云音乐',kugou:'酷狗音乐'}[v]}</option>`).join('')}</select></label><label>歌单或专辑 ID<input id="record-id" value="${esc(c.id)}" maxlength="64"></label><label>内容类型<select id="record-type">${['playlist','album','song'].map(v=>`<option value="${v}" ${v===c.type?'selected':''}>${{playlist:'歌单',album:'专辑',song:'单曲'}[v]}</option>`).join('')}</select></label><label>Meting API（可配置自有服务）<input id="record-api" value="${esc(c.api)}"></label><details><summary>自选直链歌曲 JSON</summary><p>每首填写 name、artist、url、cover、lrc；歌词为 LRC 文件地址。只收录有权使用的音源；留空不伪造歌词。</p><textarea id="record-local" rows="7">${esc(JSON.stringify(c.localTracks,null,2))}</textarea></details><div class="modal-actions"><button class="primary" id="record-save">保存并换唱片</button><button class="secondary" id="record-offline">恢复两张离线唱片</button></div>`,'music-settings');
  document.getElementById('record-save')!.onclick=()=>{try{
   const value=(id:string)=>(document.getElementById(id) as HTMLInputElement).value;
   const tracks=JSON.parse(value('record-local'));if(!Array.isArray(tracks)||!tracks.length||tracks.length>60||!tracks.every(validMusicTrack))throw Error('请填写 1–60 张唱片，并检查每首的音源、封面和歌词地址。');
   const candidate={mode:value('record-mode'),server:value('record-server'),id:value('record-id').trim(),type:value('record-type'),api:value('record-api').trim(),localTracks:tracks};
   const parsed=parseMusicConfig(candidate);if(parsed.id!==candidate.id||parsed.api!==candidate.api||parsed.localTracks.length!==Math.min(60,tracks.length))throw Error('请检查歌单 ID、HTTPS API 和歌曲地址。');
   save.musicRoom=parsed;persist();ctx.close();void start();ctx.toast('新唱片放好了。');
  }catch(error){ctx.toast(error instanceof Error?error.message:'歌单格式没有填对。')}};
  document.getElementById('record-offline')!.onclick=()=>{save.musicRoom=parseMusicConfig({mode:'offline'});persist();ctx.close();void start()};
 }
 scene.bridge.on('zone',()=>{if(scene.zone==='musicroom')void start();else if(layer)stop()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)player?.pause()});
 function capture(callback:(image:HTMLImageElement)=>void){
  const artwork=cover,track=player?.list.audios[player.list.index],line=floor?.querySelector('.lyric-current')?.textContent??'';
  const pos=scene.project(268,21),edge=scene.project(370,113),lyric=scene.project(320,302);
  scene.capture(base=>{const canvas=document.createElement('canvas');canvas.width=base.width;canvas.height=base.height;const g=canvas.getContext('2d')!;g.imageSmoothingEnabled=false;g.drawImage(base,0,0);let safe=false;
   if(artwork?.complete&&artwork.naturalWidth){try{const probe=document.createElement('canvas');probe.width=probe.height=1;const test=probe.getContext('2d')!;test.drawImage(artwork,0,0,1,1);test.getImageData(0,0,1,1);safe=true}catch{}}
   if(safe&&artwork)g.drawImage(artwork,pos.x,pos.y,edge.x-pos.x,edge.y-pos.y);else{g.fillStyle='#493847';g.fillRect(pos.x,pos.y,edge.x-pos.x,edge.y-pos.y);g.fillStyle='#f3d7a1';g.font='16px CottagePixel';g.textAlign='center';g.fillText(track?.name??'一起听歌', (pos.x+edge.x)/2,(pos.y+edge.y)/2,edge.x-pos.x-8)}
   g.save();g.translate(lyric.x,lyric.y);g.scale(1,.65);g.textAlign='center';g.font='24px CottagePixel';g.fillStyle='#ffe7b6';g.shadowColor='#ebba74';g.shadowBlur=8;g.fillText(line,0,0,canvas.width*.5);g.restore();
   const image=new Image();image.onload=()=>callback(image);image.src=canvas.toDataURL('image/png');
  });
 }
 return {capture,interact(id:string){if(!id.startsWith('music-')||scene.zone!=='musicroom'||id==='music-seat'||id==='music-window-seat')return false;if(id==='music-records')playlist();else if(id==='music-turntable')play();else if(id==='music-next'){needleUntil=performance.now()+1000;player?.skipForward()}else if(id==='music-floor'){floor?.classList.toggle('soft');save.notes['music-projection']=floor?.classList.contains('soft')?'soft':'bright';persist()}else if(id==='music-note')ctx.note();else if(id==='music-photo')ctx.photo();return true},stop};
}
