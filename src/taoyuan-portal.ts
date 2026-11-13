export type TaoyuanEnvelope={kind:'state';save:string;route:string}|{kind:'command';route:string;index:number;text:string};
export function openTaoyuan(options:{role:'host'|'guest'|'offline';onExit:()=>void;onMessage?:(message:TaoyuanEnvelope)=>void}){
 const panel=document.createElement('section');panel.id='taoyuan-portal';panel.style.cssText='position:fixed;inset:0;z-index:10000;background:#211e21;display:flex;flex-direction:column';
 const exit=document.createElement('button');exit.textContent='返回生日小屋 · 桃源乡 setube / CC BY-NC 4.0';exit.style.cssText='min-height:48px;font:18px CottagePixel,monospace';
 const frame=document.createElement('iframe');frame.title='桃源乡 · 双人的田庄';frame.src=new URL('taoyuan/index.html',document.baseURI).href;frame.style.cssText='flex:1;width:100%;border:0;background:#211e21';panel.append(exit,frame);document.body.append(panel);
 let ready=false,pending:TaoyuanEnvelope|undefined;
 const origin=new URL(frame.src).origin;
 const send=(message:unknown)=>frame.contentWindow?.postMessage({channel:'lovehouse-taoyuan',...message as object},origin);
 const handler=(event:MessageEvent)=>{if(event.source!==frame.contentWindow||event.origin!==origin||event.data?.channel!=='lovehouse-taoyuan')return;if(event.data.type==='ready'){ready=true;send({type:'role',role:options.role});if(pending)send({type:'receive',payload:pending})}else if(event.data.type==='event')options.onMessage?.(event.data.payload)};
 window.addEventListener('message',handler);exit.onclick=()=>{window.removeEventListener('message',handler);panel.remove();options.onExit()};
 return{receive:(payload:TaoyuanEnvelope)=>{pending=payload;if(ready)send({type:'receive',payload})},close:()=>exit.click()};
}
