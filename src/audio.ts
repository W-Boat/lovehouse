import personal from '../content/personal.json';
import {save} from './state';
let active=false,zone='room',current:HTMLAudioElement|undefined,currentTrack='',context:AudioContext|undefined,wind:AudioBufferSourceNode|undefined,windGain:GainNode|undefined;
const url=(name:string)=>new URL('../audio/'+name,import.meta.url).href;
const sounds=new Map<number,HTMLAudioElement>();
const retiring=new Set<HTMLAudioElement>();
let musicGeneration=0,ducked=false;
const musicLevel=()=>save.settings.musicVolume*(ducked?.45:1);
export function haptic(kind:'soft'|'success'|'error'='soft'){if(save.settings.haptics&&typeof navigator!=='undefined'&&navigator.vibrate)navigator.vibrate(kind==='success'?[18,35,18]:kind==='error'?[12,40,12]:10)}
export function sound(note=783){if(!active||save.settings.sfxVolume===0)return;haptic('soft');const index=Math.abs(Math.round(note))%5;let audio=sounds.get(index);if(!audio){audio=new Audio(url('ui-'+index+'.wav'));sounds.set(index,audio)}audio.volume=save.settings.sfxVolume*.45;audio.currentTime=0;void audio.play().catch(()=>{})}
export async function music(userGesture=false){
 if(userGesture){
  active=true;
  try{context??=new AudioContext();if(context.state!=='running')void context.resume().then(refreshWind,()=>{})}catch{}
 }
 if(!active)return;
 refreshWind();
 if(!save.music||document.hidden){pauseMusic();return}
 const override=zone==='mars'&&personal.concertAudio;
 const track=override||(['cinema','memory','mars'].includes(zone)?'childhood':'moonlight');
 if(current&&track===currentTrack){
  if(!retiring.size)current.volume=musicLevel();
  void current.play().catch(()=>{});
  return;
 }
 const previous=current;
 for(const audio of retiring)audio.pause();
 retiring.clear();
 if(previous)retiring.add(previous);
 const generation=++musicGeneration;
 const fresh=new Audio(override?new URL('../'+override,import.meta.url).href:url(track+'.m4a'));
 current=fresh;currentTrack=track;fresh.loop=true;fresh.volume=0;
 const previousVolume=previous?.volume??0;
 try{await fresh.play()}catch{
  if(generation===musicGeneration){previous?.pause();retiring.clear()}
  return;
 }
 if(generation!==musicGeneration)return;
 const start=performance.now();
 const fade=()=>{
  if(generation!==musicGeneration)return;
  const progress=Math.min(1,(performance.now()-start)/900);
  fresh.volume=musicLevel()*progress;
  if(previous)previous.volume=Math.min(previousVolume,musicLevel())*(1-progress);
  if(progress<1)requestAnimationFrame(fade);
  else{previous?.pause();retiring.clear()}
 };
 requestAnimationFrame(fade);
}
function pauseMusic(){
 musicGeneration++;
 current?.pause();
 for(const audio of retiring)audio.pause();
 retiring.clear();
}
export function setAmbience(next:string){zone=next;void music()}
export function duckAudio(duck:boolean){
 ducked=duck;
 if(current&&!retiring.size)current.volume=musicLevel();
}
function refreshWind(){try{wind?.stop();wind=undefined;windGain?.disconnect();if(!active||save.settings.ambientVolume===0||document.hidden||['room','memory','cinema','aquarium'].includes(zone)||!context||context.state!=='running')return;const buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate),data=buffer.getChannelData(0);let v=0;for(let i=0;i<data.length;i++){v=(v+(Math.random()-.5)*.07)*.98;data[i]=v}wind=context.createBufferSource();wind.buffer=buffer;wind.loop=true;windGain=context.createGain();windGain.gain.value=save.settings.ambientVolume*.05;wind.connect(windGain).connect(context.destination);wind.start()}catch{}}
document.addEventListener('visibilitychange',()=>{if(document.hidden){pauseMusic();refreshWind()}else void music()});
