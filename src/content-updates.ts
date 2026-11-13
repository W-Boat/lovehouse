import {uiCopy,formatCopy} from '../content/ui-copy';
import {persist} from './state';

type UpdateStatus={phase:string;message:string;progress:number;version:number;url:string;availableVersion:number};
type UpdateCommand={action:'status'|'ready'|'check'|'install'|'rollback';url?:string};
let latest:UpdateStatus|undefined,host:HTMLElement|undefined,listening=false;

export function sendContentUpdate(command:UpdateCommand){
 const native=(window as Window&{CottageSave?:{postMessage:(message:string)=>void}}).CottageSave;
 if(!native)return false;
 if(command.action==='install'||command.action==='rollback')persist();
 native.postMessage(JSON.stringify({kind:'content-update',...command}));
 return true;
}

export function mountContentUpdates(parent:HTMLElement){
 if(!(window as Window&{CottageSave?:unknown}).CottageSave)return;
 host=document.createElement('section');host.className='content-updates';parent.append(host);
 const element=<K extends keyof HTMLElementTagNameMap>(tag:K,text='',target:HTMLElement=host!)=>{
  const node=document.createElement(tag);node.textContent=text;target.append(node);return node;
 };
 element('h3',uiCopy('updates.title'));
 element('p',uiCopy('updates.help'));
 const label=element('label',uiCopy('updates.address'));
 const input=element('input','',label);input.id='content-update-url';input.type='url';input.maxLength=2048;input.placeholder='https://';input.value=latest?.url??'';
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
 (get('install') as HTMLButtonElement).disabled=status?.phase!=='available';
 (get('rollback') as HTMLButtonElement).disabled=busy;
 const value=Math.max(0,Math.min(100,status?.progress??0));
 get('progress').setAttribute('aria-valuenow',String(value));
 Array.from(get('progress').children).forEach((cell,index)=>cell.classList.toggle('lit',index<Math.ceil(value/5)));
}
