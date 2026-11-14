import {nativeBridge} from './native-bridge';
import {defaultContentServer} from './cloud-content';
import {uiCopy,formatCopy} from '../content/ui-copy';
import {persist} from './state';

type UpdateStatus={phase:string;message:string;progress:number;version:number;url:string;availableVersion:number;canRetry?:boolean;nativeBase?:string;nativeRevision?:string;autoUpdate?:boolean};
type UpdateCommand={action:'status'|'ready'|'check'|'install'|'rollback'|'set-auto';url?:string;enabled?:boolean};
let latest:UpdateStatus|undefined,host:HTMLElement|undefined,listening=false;

function defaultAndroidUpdateUrl(){
 const server=defaultContentServer();
 if(!server)return '';
 try{
  const url=new URL('android-update/update.json',server.replace(/\/?$/,'/'));
  return url.protocol==='https:'?url.href:'';
 }catch{return ''}
}


export function sendContentUpdate(command:UpdateCommand){
 const native=nativeBridge();
 if(!native)return false;
 if(command.action==='install'||command.action==='rollback')persist();
 native.postMessage(JSON.stringify({kind:'content-update',...command}));
 return true;
}

export function mountContentUpdates(parent:HTMLElement){
 mountPackageDownloads(parent);
 if(!nativeBridge())return;
 host=document.createElement('section');host.className='content-updates';parent.append(host);
 const element=<K extends keyof HTMLElementTagNameMap>(tag:K,text='',target:HTMLElement=host!)=>{
  const node=document.createElement(tag);node.textContent=text;target.append(node);return node;
 };
 element('h3',uiCopy('updates.title'));
 element('p',uiCopy('updates.help'));
 const label=element('label',uiCopy('updates.address'));
 const input=element('input','',label);input.id='content-update-url';input.type='url';input.maxLength=2048;input.placeholder='https://';input.value=latest?.url||defaultAndroidUpdateUrl();
 const auto=element('button','启动时自动下载并校验资源');
 auto.id='content-update-auto';
 auto.type='button';
 auto.className='secondary';
 auto.hidden=true;
 auto.setAttribute('aria-label','启动时自动下载并校验资源');
 auto.onclick=()=>{
  if(typeof latest?.autoUpdate==='boolean'){
   sendContentUpdate({action:'set-auto',enabled:!latest.autoUpdate});
  }
 };
 const version=element('p');version.id='content-update-version';
 const status=element('output');status.id='content-update-status';status.setAttribute('role','status');
 const progress=element('div');progress.id='content-update-progress';progress.className='content-update-progress';progress.setAttribute('role','progressbar');progress.setAttribute('aria-label',uiCopy('updates.progress'));progress.setAttribute('aria-valuemin','0');progress.setAttribute('aria-valuemax','100');
 for(let i=0;i<20;i++)element('b','',progress);
 const controls=element('div');controls.className='modal-actions';
 const button=(id:string,text:string,action:()=>void)=>{
  const node=element('button',text,controls);node.type='button';node.id=id;node.className='secondary';node.onclick=action;
 };
 button('content-update-check',uiCopy('updates.check'),()=>{
  const url=input.value.trim();
  if(!input.checkValidity()||!url.startsWith('https://')){status.textContent=uiCopy('updates.invalid-url');return}
  checkingAtEntry=false;
  sendContentUpdate({action:'check',url});
 });
 button('content-update-install',uiCopy('updates.install'),()=>sendContentUpdate({action:'install'}));
 button('content-update-rollback',uiCopy('updates.rollback'),()=>sendContentUpdate({action:'rollback'}));
 listenForContentUpdates();
 paint();sendContentUpdate({action:'status'});
}

let entryCheck=false,checkingAtEntry=false,shownVersion=0;
let startupProgress:HTMLElement|undefined,startupTimer:number|undefined,startupWindowClosed=false;

function reflectNativeStartup(status:UpdateStatus){
 if(!status.nativeBase)return;
 if(status.phase!=='checking'&&status.phase!=='downloading'){
  window.clearTimeout(startupTimer);
  startupProgress?.remove();startupProgress=undefined;
  startupWindowClosed=true;
  return;
 }
 if(startupWindowClosed)return;
 if(!startupProgress){
  const parent=document.getElementById('app');
  if(!parent)return;
  startupProgress=document.createElement('aside');
  startupProgress.className='online-first-invitation';
  startupProgress.setAttribute('role','status');
  parent.append(startupProgress);
  startupTimer=window.setTimeout(()=>{
   startupWindowClosed=true;
   startupProgress?.remove();startupProgress=undefined;
  },12000);
 }
 startupProgress.textContent=status.phase==='checking'?'正在检查小屋资源…':status.message+' · '+status.progress+'%';
}

export function observeResourceUpdateOnStartup(){
 if(!nativeBridge())return;
 void checkPackageOnEntry();
 listenForContentUpdates();
 sendContentUpdate({action:'status'});
}
function listenForContentUpdates(){
 if(listening)return;
 listening=true;
 document.addEventListener('cottage-update-status',event=>{
  latest=(event as CustomEvent<UpdateStatus>).detail;
  paint();
  reflectNativeStartup(latest);
  if(latest.nativeBase){
   if(latest.phase==='available'&&latest.availableVersion>latest.version)showResourceUpdate(latest.availableVersion,latest.progress===100);
   return;
  }
  if(!checkingAtEntry)return;
  if(latest.phase==='available'&&latest.availableVersion>latest.version){
   checkingAtEntry=false;
   showResourceUpdate(latest.availableVersion);
  }else if(latest.phase==='error'||latest.phase==='current'||latest.phase==='busy')checkingAtEntry=false;
 });
}

export function checkResourceUpdateOnEntry(){
 const url=defaultAndroidUpdateUrl();
 if(!url||!nativeBridge()||entryCheck)return;
 entryCheck=true;
 checkingAtEntry=true;
 listenForContentUpdates();
 if(latest?.nativeBase||(window as Window&{__nativeBase?:string}).__nativeBase){sendContentUpdate({action:'status'});return}
 sendContentUpdate({action:'check',url});
}

function showResourceUpdate(version:number,staged=false){
 if(shownVersion===version)return;
 const parent=document.getElementById('app');
 if(!parent)return;
 shownVersion=version;
 document.querySelector('.resource-update-invitation')?.remove();
 const windows=staged||currentPlatform()==='windows';
 const prompt=document.createElement('aside');
 prompt.className='online-first-invitation resource-update-invitation';
 prompt.setAttribute('aria-label','小屋资源更新');
 const label=document.createElement('p');
 label.textContent=windows?'新版小屋资源 '+version+' 已准备好，重新打开小屋即可启用。':'发现新版小屋资源 '+version+'，现在更新吗？';
 const actions=document.createElement('div');
 const later=document.createElement('button');
 later.type='button';later.className='secondary';later.textContent='稍后再说';
 later.onclick=()=>prompt.remove();
 actions.append(later);
 if(!windows){
  const install=document.createElement('button');
  install.type='button';install.className='primary';install.textContent='下载并重启小屋';
  install.onclick=()=>{sendContentUpdate({action:'install'});prompt.remove()};
  actions.append(install);
 }
 prompt.append(label,actions);
 parent.append(prompt);
}

function paint(){
 if(!host?.isConnected)return;
 const get=(id:string)=>host!.querySelector<HTMLElement>('#content-update-'+id)!;
 const status=latest,busy=Boolean(status&&['checking','downloading','installed','busy'].includes(status.phase));
 get('status').textContent=status?.message??uiCopy('updates.idle');
 const auto=get('auto');auto.hidden=!(status?.nativeBase&&currentPlatform()==='android'&&typeof status.autoUpdate==='boolean');
 const autoEnabled=status?.autoUpdate===true;
 auto.textContent='启动时自动下载并校验资源：'+(autoEnabled?'开启':'关闭');
 auto.setAttribute('aria-pressed',String(autoEnabled));
 get('version').textContent=status?formatCopy('updates.version',{version:status.version}):'';
 const input=get('url') as HTMLInputElement;
 if(!input.value&&status?.url&&document.activeElement!==input)input.value=status.url;
 input.disabled=busy;
 (get('check') as HTMLButtonElement).disabled=busy;
 (get('install') as HTMLButtonElement).disabled=status?.phase!=='available'&&!status?.canRetry;
 (get('rollback') as HTMLButtonElement).disabled=busy;
 const value=Math.max(0,Math.min(100,status?.progress??0));
 get('progress').setAttribute('aria-valuenow',String(value));
 Array.from(get('progress').children).forEach((cell,index)=>cell.classList.toggle('lit',index<Math.ceil(value/5)));
}


declare const __BUILD_INFO__: {version:string;builtAt:string};
type Platform='android'|'windows';
const platformNames={android:'Android APK',windows:'Windows 便携 ZIP'};
function currentPlatform():Platform|undefined{
 const native=window as Window&{CottageSave?:unknown;__storageMode?:string};
 if(native.CottageSave)return 'android';
 if(native.__storageMode)return 'windows';
}
async function packageFor(platform:Platform){
 const catalog=new URL('packages.json?view=full',defaultContentServer().replace(/\/?$/,'/'));
 if(catalog.protocol!=='https:')throw Error('HTTPS required');
 const controller=new AbortController();
 const timeout=window.setTimeout(()=>controller.abort(),15000);
 let entry;
 try{
  const response=await fetch(catalog,{signal:controller.signal,cache:'no-store',credentials:'omit'});
  if(!response.ok)throw Error('Package catalog unavailable');
  entry=(await response.json())?.[platform];
 }finally{window.clearTimeout(timeout)}
 if(!entry||typeof entry.version!=='string')return;
 const native=window as Window&{__nativeBase?:string;__nativeRevision?:string};
 const shell=entry.thinPackage;
 const installedShell=latest?.nativeRevision||native.__nativeRevision;
 const installedBase=latest?.nativeBase||native.__nativeBase;
 const useShell=platform===currentPlatform()&&shell?.baseVersion===entry.version&&
  (installedBase===entry.version||!installedBase&&entry.version==='9b1d5d95b526');
 const selected=useShell?shell:entry;
 if(typeof selected.path!=='string'||typeof selected.version!=='string'||!/^[-.\w]{1,64}$/.test(selected.version))return;
 const url=new URL(selected.path,catalog);
 const extension=platform==='android'?'apk':'zip';
 if(url.origin!==catalog.origin||url.username||url.password||!url.pathname.startsWith(new URL('packages/',catalog).pathname)||!url.pathname.endsWith('.'+extension))return;
 const local=__BUILD_INFO__.version,version=selected.version as string;
 const same=version===local||(/^[a-f0-9]{7,40}$/i.test(version)&&/^[a-f0-9]{7,40}$/i.test(local)&&(local.startsWith(version)||version.startsWith(local)));
 const newer=useShell?installedShell!==version:!same&&Date.parse(selected.publishedAt)>Date.parse(__BUILD_INFO__.builtAt);
 return {url:url.href,version,newer,thin:useShell,title:typeof selected.title==='string'?selected.title.trim().slice(0,80):''};
}
let checkedOnEntry=false;
let checkingPackage=false;
export async function checkPackageOnEntry(){
 const platform=currentPlatform();
 if(!platform||checkedOnEntry||checkingPackage)return;
 checkingPackage=true;
 listenForContentUpdates();
 sendContentUpdate({action:'status'});
 try{
  const entry=await packageFor(platform);
  if(!entry?.newer){checkedOnEntry=true;return}
  const dialog=document.createElement('dialog');
  dialog.className='package-update-dialog';
  const title=document.createElement('h2');
  title.textContent=entry.title||(entry.thin?'发现 '+platformNames[platform]+' 薄包更新':'发现 '+platformNames[platform]+' 更新');
  const version=document.createElement('p');version.textContent='可下载版本 '+entry.version;
  const actions=document.createElement('div');actions.className='modal-actions';
  const later=document.createElement('button');later.type='button';later.className='secondary';later.textContent='稍后';
  later.onclick=()=>dialog.close();
  const link=document.createElement('a');link.className='primary';link.href=entry.url;link.textContent='下载更新';
  actions.append(later,link);dialog.append(title,version,actions);
  (document.getElementById('app')??document.body).append(dialog);
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  if(typeof dialog.showModal==='function'){
   try{dialog.showModal()}catch{dialog.setAttribute('open','')}
  }else dialog.setAttribute('open','');
  checkedOnEntry=true;
 }catch{
  window.addEventListener('online',()=>void checkPackageOnEntry(),{once:true});
 }finally{checkingPackage=false}
}
function mountPackageDownloads(parent:HTMLElement){
 if(!defaultContentServer())return;
 const section=document.createElement('section');section.className='content-updates';
 const title=document.createElement('h3');title.textContent='客户端安装包';
 section.append(title);parent.append(section);
 for(const platform of ['android','windows'] as const){
  const check=document.createElement('button');
  check.type='button';check.className='secondary';check.textContent='检查 '+platformNames[platform]+' 更新';
  const result=document.createElement('div');result.setAttribute('aria-live','polite');
  section.append(check,result);
  check.onclick=async()=>{
   check.disabled=true;result.textContent='正在查询…';
   try{
    const entry=await packageFor(platform);
    if(!entry){result.textContent='暂无可下载版本。';return}
    const link=document.createElement('a');
    link.href=entry.url;link.className='secondary';
    link.textContent='下载 '+platformNames[platform]+(entry.thin?' 薄包':'')+' · '+entry.version;
    result.replaceChildren(link);
    if(currentPlatform()===platform&&!entry.newer)result.prepend('当前版本无需更新。 ');
   }catch{result.textContent='暂时无法获取安装包，请稍后重试。'}
   finally{check.disabled=false}
  };
 }
}
