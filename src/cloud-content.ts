import {validateCloudMedia} from '../content/cloud-media.mjs';
import {validateCloudInteractions,validateGiftGames,type CloudInteraction} from '../content/cloud-interactions.mjs';
import {validatePortalUrl} from '../content/cloud-portal-url.mjs';
import {validateCloudScenes,type CloudScene} from '../content/cloud-scenes.mjs';
import personal from '../content/personal.json';
import {validateCloudPlaylist} from '../content/cloud-playlist.mjs';
import {parseMusicConfig,type MusicRoomConfig} from './music-config';

declare const __CONTENT_SERVER__: string;
type Portal = {label:string;url:string};
export let cloudPortals: Portal[] = [];
export let cloudGiftGames:NonNullable<ReturnType<typeof validateGiftGames>>={};
export let cloudScenes:CloudScene[]=[];
export let cloudInteractions:CloudInteraction[]=[];
export let cloudMusicRoom: MusicRoomConfig|undefined;

function readSnapshot(raw:unknown) {
 if (!raw || typeof raw !== 'object') throw Error('Invalid content snapshot');
 const data=raw as Record<string,unknown>;
 if(data.schema!==1 || typeof data.revision!=='string' || !/^[a-f0-9]{64}$/.test(data.revision)) throw Error('Invalid content revision');
 const texts=data.texts;
 if(!texts || typeof texts!=='object' || Array.isArray(texts)) throw Error('Invalid copy');
 const entries=Object.entries(texts);
 if(entries.length>4000 || entries.some(([key,value])=>!/^[a-z0-9][a-z0-9.-]{0,180}$/i.test(key)||typeof value!=='string'||value.length>20000)) throw Error('Invalid copy entry');
 const portals=data.portals??[];
 if(!Array.isArray(portals)||portals.length>2) throw Error('Invalid portals');
 const safePortals=portals.map((item:Portal)=>{
  if(!item || typeof item.label!=='string'||item.label.length>32) throw Error('Invalid portal');
  return {label:item.label,url:validatePortalUrl(item.url)};
 });
 return {schema:1,revision:data.revision,texts:Object.fromEntries(entries) as Record<string,string>,portals:safePortals,musicRoom:validateCloudPlaylist(data.musicRoom),media:validateCloudMedia(data.media),interactions:validateCloudInteractions(data.interactions),scenes:validateCloudScenes(data.scenes),giftGames:validateGiftGames(data.giftGames)};
}

export async function syncCloudContent(){
 if(typeof __CONTENT_SERVER__!=='string'||!__CONTENT_SERVER__)return;
 let endpoint:URL;
 try{endpoint=new URL('content.json',__CONTENT_SERVER__.replace(/\/?$/,'/'));if(endpoint.protocol!=='https:')throw Error('HTTPS required')}catch{document.body.dataset.cloudOffline='true';return}
 const key='cottage-cloud:'+endpoint.href;
 let snapshot:ReturnType<typeof readSnapshot>|undefined;
 try {snapshot=readSnapshot(JSON.parse(localStorage.getItem(key)??'null'))}catch{}
 try {
  if(snapshot)endpoint.searchParams.set('revision',snapshot.revision);
  const response=await fetch(endpoint,{signal:AbortSignal.timeout(2200),credentials:'omit',cache:'no-store'});
  if(response.status!==304 && response.status!==204){
   if(!response.ok)throw Error('Content unavailable');
   const reader=response.body?.getReader();if(!reader)throw Error('Missing body');
   const decoder=new TextDecoder();let bytes=0,raw='';
   try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>1_000_000)throw Error('Content too large');raw+=decoder.decode(value,{stream:true})}raw+=decoder.decode()}catch(error){void reader.cancel();throw error}
   snapshot=readSnapshot(JSON.parse(raw));
   try {localStorage.setItem(key,JSON.stringify(snapshot))}catch{}
  }else if(!snapshot)throw Error('Missing local snapshot');
 }catch{document.body.dataset.cloudOffline='true'}
 if(snapshot){
  Object.assign(personal.texts,snapshot.texts);
  Object.assign(personal,snapshot.media);
  cloudPortals=snapshot.portals;
  cloudScenes=snapshot.scenes??[];
  cloudGiftGames=snapshot.giftGames??{};
  cloudInteractions=snapshot.interactions??[];
  cloudMusicRoom=snapshot.musicRoom?parseMusicConfig(snapshot.musicRoom):undefined;
 }
}
