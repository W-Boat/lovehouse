import {preparedResource} from './release-resources';
import type {MusicRoomConfig,MusicTrack} from './music-config';
export type HeoPlayer={audio:HTMLAudioElement;list:{audios:MusicTrack[];index:number;switch:(index:number)=>void};lrc?:{current:[number,string][]};on:(name:string,fn:()=>void)=>void;play:()=>Promise<void>|void;pause:()=>void;toggle:()=>void;skipForward:()=>void;skipBack:()=>void;seek:(seconds:number)=>void;volume:(value:number,remember?:boolean)=>void;destroy:()=>void};
let metingRuntime:Promise<void>|undefined;
type HeoGlobals=Window&{APlayer?:new(options:Record<string,unknown>)=>HeoPlayer;heo?:{setupMediaSessionHandlers:(player:HeoPlayer)=>void}};
const base=new URL('heomusic/',document.baseURI);
let runtime:Promise<void>|undefined;
function script(path:string){return new Promise<void>((resolve,reject)=>{const node=document.createElement('script');node.src=new URL(path,base).href;node.onload=()=>resolve();node.onerror=()=>{node.remove();reject(Error('播放器资源暂未载入'))};document.head.append(node)})}
async function prepare(){if(!runtime)runtime=(async()=>{await script('js/APlayer.min.js')})().catch(error=>{runtime=undefined;throw error});await runtime}
/** Uses the pinned HeoMusic APlayer/Meting engines; the original page is replaced by scene props. */
export async function createHeoEngine(config:MusicRoomConfig,onPlayer:(player:HeoPlayer)=>void,onError:(text:string)=>void){
 await prepare();const globals=window as HeoGlobals,host=document.createElement('div');host.className='heo-audio-engine';host.setAttribute('aria-hidden','true');document.body.append(host);
 let player:HeoPlayer|undefined,disposed=false,timer:number|undefined;
 const attach=(value:HeoPlayer)=>{if(disposed){value.destroy();return}clearTimeout(timer);player=value;onPlayer(value)};
 const media=(value:string)=>preparedResource(new URL(value,document.baseURI).href);
 if(config.mode==='offline')attach(new globals.APlayer!({container:host,autoplay:false,preload:'metadata',lrcType:3,audio:config.localTracks.map(t=>({...t,url:media(t.url),cover:t.cover?media(t.cover):'',lrc:t.lrc?media(t.lrc):''})),listFolded:true,mutex:true}));
 else{
  if(!customElements.get('meting-js'))try{await (metingRuntime??=(script('js/Meting.js').catch(error=>{metingRuntime=undefined;throw error})))}catch(error){host.remove();throw error}
  if(disposed){host.remove();return()=>{}}
  const meting=document.createElement('meting-js');for(const [key,value]of Object.entries({id:config.id,server:config.server,type:config.type,api:preparedResource(config.api),autoplay:'false',preload:'metadata',order:'list',mutex:'true'}))meting.setAttribute(key,value);meting.addEventListener('lovehouse-player-error',()=>{clearTimeout(timer);if(!disposed)onError('歌单暂时不可用，请检查配置或使用离线唱片。')});meting.addEventListener('lovehouse-player-ready',event=>attach((event as CustomEvent<HeoPlayer>).detail));host.append(meting);
  timer=window.setTimeout(()=>{if(!player&&!disposed)onError('歌单暂未连上。可以检查歌单设置，或切换离线唱片。')},12000);
 }
 return()=>{disposed=true;clearTimeout(timer);const meting=host.querySelector('meting-js') as (HTMLElement&{lock?:boolean})|null;if(meting)meting.lock=true;player?.destroy();host.remove()};
}
