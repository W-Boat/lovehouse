import type {CinemaState} from './online-protocol';

type RoomPlayback = {
 read:()=>{state:CinemaState;now:number}|undefined;
 control?:(position:number,paused:boolean)=>void;
};

export function playSharedMovie(host:HTMLElement,url:string,room:RoomPlayback){
 const events=new AbortController();
 const listeners={signal:events.signal};
 const video=document.createElement('video');
 video.playsInline=true;
 video.preload='metadata';
 video.className='shared-movie-video';
 video.setAttribute('aria-label','双人放映');
 const controls=document.createElement('div');
 controls.className='shared-movie-controls';
 const status=document.createElement('p');
 status.setAttribute('role','status');
 status.textContent='正在加载片源…';
 const play=document.createElement('button');
 play.type='button';play.disabled=true;play.textContent='播放';
 const progress=document.createElement('input');
 progress.type='range';progress.min='0';progress.max='0';progress.step='0.1';progress.disabled=true;
 progress.setAttribute('aria-label','电影播放进度');
 const time=document.createElement('output');
 const audio=document.createElement('button');
 audio.type='button';audio.textContent='静音';
 audio.onclick=()=>{video.muted=!video.muted;audio.textContent=video.muted?'打开声音':'静音'};
 play.hidden=!room.control;
 controls.append(play,progress,time,audio);
 host.replaceChildren(video,controls,status);

 let disposed=false,loadingError=false,usingGesture=false,playPending=false,dragging=false;
 let pending:{anchor:number;until:number}|undefined;
 let destroyHls:(()=>void)|undefined;
 const unlock=document.createElement('button');
 unlock.type='button';unlock.textContent='点一下继续同步播放';unlock.hidden=true;
 controls.append(unlock);
 const clock=(t:number)=>[Math.floor(t/60),Math.floor(t%60)].map(n=>String(n).padStart(2,'0')).join(':');
 const fail=()=>{
  loadingError=true;play.disabled=true;progress.disabled=true;
  status.textContent='片源无法播放。请检查链接权限、格式或跨域设置，再让房主更换链接。';
 };

 function tryPlay(){
  if(playPending||disposed||loadingError)return;
  playPending=true;
  void video.play().then(()=>{usingGesture=false;unlock.hidden=true}).catch(error=>{
   if(disposed||error.name==='AbortError')return;
   if(error.name==='NotAllowedError'){usingGesture=true;unlock.hidden=false}
   else fail();
  }).finally(()=>{playPending=false});
 }
 unlock.onclick=()=>{usingGesture=false;tryPlay()};
 function send(position:number,paused:boolean){
  const current=room.read();
  if(!current||!room.control||!Number.isFinite(position))return;
  pending={anchor:current.state.anchor,until:performance.now()+1200};
  room.control(position,paused);
 }
 play.onclick=()=>{
  const current=room.read();
  if(!current)return;
  const paused=!current.state.paused&&!video.ended;
  send(video.ended?0:video.currentTime,paused);
  if(paused)video.pause();
  else{if(video.ended)video.currentTime=0;usingGesture=false;tryPlay()}
 };
 progress.addEventListener('input',()=>{dragging=true;time.textContent=clock(Number(progress.value))+' / '+clock(video.duration)},listeners);
 progress.addEventListener('change',()=>{
  dragging=false;
  const current=room.read();
  if(current&&Number.isFinite(video.duration)){
   video.currentTime=Number(progress.value);
   send(video.currentTime,current.state.paused||video.paused&&video.ended);
  }
 },listeners);
 progress.addEventListener('blur',()=>{dragging=false},listeners);
 video.addEventListener('ended',()=>{const current=room.read();if(current&&!current.state.paused)send(video.currentTime,true)},listeners);
 video.addEventListener('error',fail,listeners);
 function sync(){
  const current=room.read();
  if(!current||loadingError||video.readyState===0)return;
  const {state,now}=current;
  const duration=video.duration;
  const seekable=Number.isFinite(duration)&&duration>0;
  let target=state.position+(state.paused?0:Math.max(0,now-state.anchor)/1000);
  if(seekable)target=Math.min(duration,target);
  if(pending&&pending.anchor===state.anchor&&performance.now()<pending.until)return;
  pending=undefined;
  const drift=target-video.currentTime;
  if(seekable&&!dragging&&Math.abs(drift)>(state.paused ? .15 : .85))video.currentTime=target;
  const ended=seekable&&target>=duration-.06;
  const paused=state.paused||ended;
  video.playbackRate=paused||Math.abs(drift)<.16||Math.abs(drift)>.85?1:(drift>0?1.05:.95);
  if(paused){if(!video.paused)video.pause();unlock.hidden=true}
  else if(video.paused&&!usingGesture)tryPlay();
  else if(usingGesture)unlock.hidden=false;
  play.disabled=false;
  play.textContent=ended?'重播':paused?'播放':'暂停';
  progress.disabled=!room.control||!seekable;
  if(seekable){
   progress.max=String(duration);
   if(!dragging){progress.value=String(video.currentTime);time.textContent=clock(video.currentTime)+' / '+clock(duration)}
  }
  status.textContent=room.control?(seekable?'房主控制两端播放':'直播片源通常无法拖进度'):'与房主同步';
 }
 video.addEventListener('loadedmetadata',sync,listeners);
 document.addEventListener('visibilitychange',sync,listeners);
 const timer=window.setInterval(sync,200);
 if(/\.m3u8$/i.test(new URL(url).pathname)&&!video.canPlayType('application/vnd.apple.mpegurl')){
  void import('hls.js').then(({default:Hls})=>{
   if(disposed)return;
   if(!Hls.isSupported()){fail();return}
   const engine=new Hls();
   destroyHls=()=>engine.destroy();
   engine.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal)fail()});
   engine.loadSource(url);
   engine.attachMedia(video);
  }).catch(()=>{if(!disposed)fail()});
 }else video.src=url;

 return()=>{
  disposed=true;events.abort();window.clearInterval(timer);
  destroyHls?.();video.pause();video.removeAttribute('src');video.load();
 };
}

