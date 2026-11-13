import type {TaoyuanField} from './online-protocol';
import {uiCopy} from '../content/ui-copy';
export type TaoyuanEnvelope=({kind:'field'}&TaoyuanField)|{kind:'state';save:string;route:string}|{kind:'command';route:string;index:number;text:string};
export function openTaoyuan(options:{role:'host'|'guest'|'offline';identity:{name:string;gender:'male'|'female'};onExit:()=>void;onMessage?:(message:TaoyuanEnvelope)=>void}){
 const panel=document.createElement('section');panel.id='taoyuan-portal';panel.style.cssText='position:fixed;inset:0;z-index:10000;background:#211e21;display:flex;flex-direction:column';
 const exit=document.createElement('button');exit.textContent=uiCopy('taoyuan.return');exit.style.cssText='min-height:48px;font:18px CottagePixel,monospace';
 const frame=document.createElement('iframe');frame.title=uiCopy('taoyuan.title');
 const url=new URL('taoyuan/index.html',document.baseURI);
 url.searchParams.set('lovehouse-name',options.identity.name);url.searchParams.set('lovehouse-gender',options.identity.gender);
 const native=(window as Window&{CottageSave?:{postMessage:(data:string)=>void}}).CottageSave;
 native?.postMessage(JSON.stringify({kind:'orientation',value:'portrait'}));
 if(options.role==='guest')url.searchParams.set('lovehouse-role','guest');
 frame.src=url.href;frame.style.cssText='flex:1;width:100%;border:0;background:#211e21';panel.append(exit,frame);document.body.append(panel);
 let connected=true;let ready=false,pending:TaoyuanEnvelope|undefined;
 const origin=new URL(frame.src).origin;
 const send=(message:unknown)=>frame.contentWindow?.postMessage({channel:'lovehouse-taoyuan',...message as object},origin);
 const handler=(event:MessageEvent)=>{if(event.source!==frame.contentWindow||event.origin!==origin||event.data?.channel!=='lovehouse-taoyuan')return;if(event.data.type==='ready'){ready=true;send({type:'role',role:options.role});send({type:'connection',connected});if(pending)send({type:'receive',payload:pending})}else if(event.data.type==='event')options.onMessage?.(event.data.payload)};
 window.addEventListener('message',handler);exit.onclick=()=>{window.removeEventListener('message',handler);panel.remove();native?.postMessage(JSON.stringify({kind:'orientation',value:'landscape'}));options.onExit()};
 return{setConnected:(value:boolean)=>{connected=value;if(ready)send({type:'connection',connected})},receive:(payload:TaoyuanEnvelope)=>{pending=payload;if(ready)send({type:'receive',payload})},close:()=>exit.click()};
}
