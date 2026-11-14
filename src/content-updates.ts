import {nativeBridge} from './native-bridge';
import {defaultContentServer} from './cloud-content';
import {uiCopy,formatCopy} from '../content/ui-copy';
import {persist} from './state';

type UpdateStatus={phase:string;message:string;progress:number;version:number;url:string;availableVersion:number;canRetry?:boolean};
type UpdateCommand={action:'status'|'ready'|'auto'|'check'|'install'|'rollback';url?:string};
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
 if(command.action==='ready'){
  const url=defaultAndroidUpdateUrl();
  if(url)native.postMessage(JSON.stringify({kind:'content-update',action:'auto',url}));
 }
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
  sendContentUpdate({action:'check',url});
 });
 button('content-update-install',uiCopy('updates.install'),()=>sendContentUpdate({action:'install'}));
 button('content-update-rollback',uiCopy('updates.rollback'),()=>sendContentUpdate({action:'rollback'}));
 if(!listening){
  listening=true;
  document.addEventListener('cottage-update-status',event=>{latest=(event as CustomEvent<UpdateStatus>).detail;paint()});
 }
 paint();sendContentUpdate({action:'status'});
}

function paint(){
 if(!host?.isConnected)return;
 const get=(id:string)=>host!.querySelector<HTMLElement>('#content-update-'+id)!;
 const status=latest,busy=Boolean(status&&['checking','downloading','installed','busy'].includes(status.phase));
 get('status').textContent=status?.message??uiCopy('updates.idle');
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
 const catalog=new URL('packages.json',defaultContentServer().replace(/\/?$/,'/'));
 if(catalog.protocol!=='https:')throw Error('HTTPS required');
 const response=await fetch(catalog,{signal:AbortSignal.timeout(6000),cache:'no-store',credentials:'omit'});
 if(!response.ok)throw Error('Package catalog unavailable');
 const entry=(await response.json())?.[platform];
 if(!entry||typeof entry.path!=='string'||typeof entry.version!=='string'||!/^[-.\w]{1,64}$/.test(entry.version))return;
 const url=new URL(entry.path,catalog);
 const extension=platform==='android'?'apk':'zip';
 if(url.origin!==catalog.origin||url.username||url.password||!url.pathname.startsWith(new URL('packages/',catalog).pathname)||!url.pathname.endsWith('.'+extension))return;
 const local=__BUILD_INFO__.version,version=entry.version as string;
 const same=version===local||(/^[a-f0-9]{7,40}$/i.test(version)&&/^[a-f0-9]{7,40}$/i.test(local)&&(local.startsWith(version)||version.startsWith(local)));
 return {url:url.href,version,newer:!same&&Date.parse(entry.publishedAt)>Date.parse(__BUILD_INFO__.builtAt)};
}
let checkedOnEntry=false;
export async function checkPackageOnEntry(){
 const platform=currentPlatform();
 if(!platform||checkedOnEntry)return;
 checkedOnEntry=true;
 try{
  const entry=await packageFor(platform);
  if(!entry?.newer)return;
  const dialog=document.createElement('dialog');
  dialog.className='package-update-dialog';
  const title=document.createElement('h2');
  title.textContent='发现 '+platformNames[platform]+' 更新';
  const version=document.createElement('p');version.textContent='可下载版本 '+entry.version;
  const actions=document.createElement('div');actions.className='modal-actions';
  const later=document.createElement('button');later.type='button';later.className='secondary';later.textContent='稍后';
  later.onclick=()=>dialog.close();
  const link=document.createElement('a');link.className='primary';link.href=entry.url;link.download='';link.textContent='下载更新';
  actions.append(later,link);dialog.append(title,version,actions);
  (document.getElementById('app')??document.body).append(dialog);
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  dialog.showModal();
 }catch{}
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
    link.href=entry.url;link.download='';link.className='secondary';
    link.textContent='下载 '+platformNames[platform]+' · '+entry.version;
    result.replaceChildren(link);
    if(currentPlatform()===platform&&!entry.newer)result.prepend('当前版本无需更新。 ');
   }catch{result.textContent='暂时无法获取安装包，请稍后重试。'}
   finally{check.disabled=false}
  };
 }
}
