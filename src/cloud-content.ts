import {prepareReleaseResources} from './release-resources';
import {validateCloudMedia} from '../content/cloud-media.mjs';
import {validateCloudInteractions,validateGiftGames,type CloudInteraction} from '../content/cloud-interactions.mjs';
import {validatePortalUrl} from '../content/cloud-portal-url.mjs';
import {validateCloudScenes,type CloudScene} from '../content/cloud-scenes.mjs';
import {validateGiftOverrides,validateAnnouncement} from '../content/cloud-gifts.mjs';
import {birthdayConfig} from '../content/birthday-config';
import {roomWalkable} from './navigation';
import personal from '../content/personal.json';
import {validateCloudPlaylist} from '../content/cloud-playlist.mjs';
import {parseMusicConfig,type MusicRoomConfig} from './music-config';

declare const __CONTENT_SERVER__: string;
export function defaultContentServer(){return typeof __CONTENT_SERVER__==='string'?__CONTENT_SERVER__:''}
type Portal = {label:string;url:string};
let statisticsEnabled=false;
let initialNotification:ReturnType<typeof validateAnnouncement>;
export let cloudAnnouncement:ReturnType<typeof validateAnnouncement>;
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
 return {schema:1,revision:data.revision,texts:Object.fromEntries(entries) as Record<string,string>,portals:safePortals,musicRoom:validateCloudPlaylist(data.musicRoom),media:validateCloudMedia(data.media),interactions:validateCloudInteractions(data.interactions),scenes:validateCloudScenes(data.scenes),giftGames:validateGiftGames(data.giftGames),gifts:validateGiftOverrides(data.gifts),announcement:validateAnnouncement(data.announcement),notification:validateAnnouncement(data.notification),statistics:readStatistics(data.statistics),resources:readResources(data.resources)};
}

export async function verifyCloudSnapshot(raw:unknown){
 const snapshot=readSnapshot(raw);
 const body={schema:1,texts:snapshot.texts,portals:snapshot.portals,musicRoom:snapshot.musicRoom,
  media:snapshot.media,interactions:snapshot.interactions,scenes:snapshot.scenes,giftGames:snapshot.giftGames,gifts:snapshot.gifts,announcement:snapshot.announcement,notification:snapshot.notification,statistics:snapshot.statistics,resources:snapshot.resources};
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(body)));
 const revision=Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
 if(revision!==snapshot.revision)throw Error('Content checksum mismatch');
 return snapshot;
}

export async function syncCloudContent(){
 if(typeof __CONTENT_SERVER__!=='string'||!__CONTENT_SERVER__)return;
 let endpoint:URL;
 try{endpoint=new URL('content.json',__CONTENT_SERVER__.replace(/\/?$/,'/'));if(endpoint.protocol!=='https:')throw Error('HTTPS required')}catch{document.body.dataset.cloudOffline='true';return}
 const key='cottage-cloud:'+endpoint.href;
 let snapshot:ReturnType<typeof readSnapshot>|undefined;
 try {snapshot=await verifyCloudSnapshot(JSON.parse(localStorage.getItem(key)??'null'))}catch{}
 try {
  if(snapshot)endpoint.searchParams.set('revision',snapshot.revision);
  const response=await fetch(endpoint,{signal:AbortSignal.timeout(2200),credentials:'omit',cache:'no-store'});
  if(response.status!==304 && response.status!==204){
   if(!response.ok)throw Error('Content unavailable');
   const reader=response.body?.getReader();if(!reader)throw Error('Missing body');
   const decoder=new TextDecoder();let bytes=0,raw='';
   try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>1_000_000)throw Error('Content too large');raw+=decoder.decode(value,{stream:true})}raw+=decoder.decode()}catch(error){void reader.cancel();throw error}
   snapshot=await verifyCloudSnapshot(JSON.parse(raw));
   try {localStorage.setItem(key,JSON.stringify(snapshot))}catch{}
  }else if(!snapshot)throw Error('Missing local snapshot');
 }catch{document.body.dataset.cloudOffline='true'}
 if(snapshot){
  Object.assign(personal.texts,snapshot.texts);
  Object.assign(personal,snapshot.media);
  cloudAnnouncement=snapshot.announcement;
  initialNotification=snapshot.notification;
  statisticsEnabled=snapshot.statistics?.enabled===true;
  await prepareReleaseResources(snapshot,endpoint);
  for(const gift of birthdayConfig.gifts){
   const override=snapshot.gifts?.[gift.id];
   if(!override)continue;
   for(const field of ['name','subtitle','message','variant'] as const)if(override[field]!==undefined)Object.assign(personal.texts,{['gift.'+gift.id+'.'+field]:override[field]});
   if(override.point&&!roomWalkable({x:override.point[0],y:override.point[1]})){
    const {point,x,y,...copy}=override;
    Object.assign(gift,copy);
   }else Object.assign(gift,override);
  }
  cloudPortals=snapshot.portals;
  cloudScenes=snapshot.scenes??[];
  cloudGiftGames=snapshot.giftGames??{};
  cloudInteractions=snapshot.interactions??[];
  cloudMusicRoom=snapshot.musicRoom?parseMusicConfig(snapshot.musicRoom):undefined;
 }
}


export function watchSystemNotifications(display:(title:string,body:string)=>void){
 const server=defaultContentServer();
 if(!server)return;
 const endpoint=new URL('content.json',server.replace(/\/?$/,'/'));
 if(endpoint.protocol!=='https:')return;
 let revision='',checking=false,seen='';
 const session=crypto.randomUUID();
 async function sendOnlineStatus(){
  if(!statisticsEnabled||document.hidden)return;
  const form=new URLSearchParams({session,platform:navigator.platform,screen:screen.width+'x'+screen.height,language:navigator.language});
  try{await fetch(new URL('statistics',endpoint),{method:'POST',body:form,credentials:'omit',signal:AbortSignal.timeout(4000)})}catch{}
 }
 void sendOnlineStatus();
 window.setInterval(sendOnlineStatus,300000);
 const show=(notice:ReturnType<typeof validateAnnouncement>)=>{
  if(!notice?.enabled||!notice.body.trim())return;
  const key=JSON.stringify([notice.title,notice.body]);
  try{seen=localStorage.getItem('cottage-system-notification')??seen}catch{}
  if(seen===key)return;
  seen=key;
  try{localStorage.setItem('cottage-system-notification',key)}catch{}
  display(notice.title||'系统通知',notice.body);
 };
 show(initialNotification);
 async function poll(){
  if(checking||document.hidden)return;
  checking=true;
  try{
   const url=new URL(endpoint);
   if(revision)url.searchParams.set('revision',revision);
   const response=await fetch(url,{signal:AbortSignal.timeout(2500),credentials:'omit',cache:'no-store'});
   if(response.status!==304&&response.status!==204&&response.ok){
    const snapshot=await verifyCloudSnapshot(await response.json());
    revision=snapshot.revision;show(snapshot.notification);
    const enabled=snapshot.statistics?.enabled===true;
    if(enabled&&!statisticsEnabled){statisticsEnabled=true;void sendOnlineStatus()}else statisticsEnabled=enabled;
   }
  }catch{}finally{checking=false}
 }
 window.setInterval(poll,60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void poll()});
}

function readStatistics(value:unknown){
 if(value===undefined)return;
 if(!value||typeof value!=='object'||!('enabled' in value)||typeof value.enabled!=='boolean')throw Error('Invalid statistics configuration');
 return {enabled:value.enabled};
}

function readResources(value:unknown){
 if(value===undefined)return;
 if(!Array.isArray(value)||value.length>100)throw Error('Invalid resource list');
 return value.map(resource=>{
  if(typeof resource?.label!=='string'||resource.label.length>80)throw Error('Invalid resource name');
  return {label:resource.label,url:validatePortalUrl(resource.url)};
 });
}
