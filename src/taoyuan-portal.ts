import {nativeBridge} from './native-bridge';
import {showFrameLoading} from './frame-loading';
import type {TaoyuanField} from './online-protocol';
import {uiCopy} from '../content/ui-copy';
export type TaoyuanEnvelope=({kind:'field'}&TaoyuanField)|{kind:'state';save:string;route:string}|{kind:'command';route:string;index:number;text:string};
export function openTaoyuan(options:{role:'host'|'guest'|'offline';identity:{name:string;gender:'male'|'female'};onExit:()=>void;onMessage?:(message:TaoyuanEnvelope)=>void}){
 const panel=document.createElement('section');panel.id='taoyuan-portal';panel.style.cssText='position:fixed;inset:0;z-index:10000;background:#211e21;display:flex;flex-direction:column';
 const exit=document.createElement('button');exit.textContent=uiCopy('taoyuan.return');exit.className='taoyuan-return';
 const frame=document.createElement('iframe');frame.title=uiCopy('taoyuan.title');
 const url=new URL('taoyuan/index.html',document.baseURI);
 url.searchParams.set('lovehouse-name',options.identity.name);url.searchParams.set('lovehouse-gender',options.identity.gender);
 const native=nativeBridge();
 native?.postMessage(JSON.stringify({kind:'orientation',value:'portrait'}));
 if(options.role==='guest')url.searchParams.set('lovehouse-role','guest');
 frame.src=url.href;frame.style.cssText='flex:1;width:100%;border:0;background:#211e21';const toolbar=document.createElement('nav');toolbar.className='taoyuan-toolbar';const exportButton=document.createElement('button');exportButton.className='taoyuan-return';exportButton.textContent='导出存档';exportButton.disabled=true;toolbar.append(exit,exportButton);panel.append(toolbar,frame);document.body.append(panel);
 showFrameLoading(frame,panel,'正在加载桃源乡…');
 let connected=true;let ready=false,pending:TaoyuanEnvelope|undefined;
 const origin=new URL(frame.src).origin;
 const send=(message:unknown)=>frame.contentWindow?.postMessage({channel:'lovehouse-taoyuan',...message as object},origin);
 const handler=(event:MessageEvent)=>{if(event.source!==frame.contentWindow||event.origin!==origin||event.data?.channel!=='lovehouse-taoyuan')return;if(event.data.type==='ready'){ready=true;exportButton.disabled=false;send({type:'role',role:options.role});send({type:'connection',connected});if(pending)send({type:'receive',payload:pending})}else if(event.data.type==='export-result'){const save=event.data.save;if(typeof save!=='string'||save.length>2_000_000){exportButton.textContent='请先打开存档';return}if(native){native.postMessage(JSON.stringify({kind:'taoyuan-save',data:save}));return}const url=URL.createObjectURL(new Blob([save],{type:'application/octet-stream'}));const link=document.createElement('a');link.href=url;link.download='桃源乡存档.tyx';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}else if(event.data.type==='event')options.onMessage?.(event.data.payload)};
 exportButton.onclick=()=>{exportButton.textContent='导出存档';send({type:'export-save'})};window.addEventListener('message',handler);exit.onclick=()=>{window.removeEventListener('message',handler);panel.remove();native?.postMessage(JSON.stringify({kind:'orientation',value:'landscape'}));options.onExit()};
 return{setConnected:(value:boolean)=>{connected=value;if(ready)send({type:'connection',connected})},receive:(payload:TaoyuanEnvelope)=>{pending=payload;if(ready)send({type:'receive',payload})},close:()=>exit.click()};
}
