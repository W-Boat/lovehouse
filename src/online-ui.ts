import './online.css';
import {OnlineClient,type ConnectionState} from './online-client';
import type {RoomSnapshot,ServerMessage} from './online-protocol';
type Context={open:(html:string,kind?:string)=>void;close:()=>void;toast:(text:string)=>void;profile:(role?:'host'|'guest')=>{name:string;appearance?:Record<string,number>};onSnapshot?:(snapshot:RoomSnapshot)=>void;onMessage?:(message:ServerMessage)=>void;onConnection?:(state:ConnectionState)=>void;onGame?:(game:NonNullable<RoomSnapshot['game']>)=>void};
const preferenceKey='cottage-online-addresses';
export function installOnlineUI(ctx:Context){
 let addresses={server:'',defaultServer:''};try{const p=JSON.parse(localStorage.getItem(preferenceKey)||'{}');for(const k of ['server','defaultServer'] as const)if(typeof p[k]==='string')addresses[k]=p[k].slice(0,2048)}catch{}
 let snapshot:RoomSnapshot|undefined,playerId='',status:ConnectionState='offline',statusMessage='',draft='',draftRevision=0,dirty=false,pendingText:string|undefined,conflict=false,lastGame='';
 const chat:{name:string;text:string}[]=[];let host:HTMLElement|undefined;
 const client=new OnlineClient(raw=>receive(raw as ServerMessage),(state,message)=>{status=state;statusMessage=message||'';ctx.onConnection?.(state);paintStatus();if(state==='offline'){snapshot=undefined;playerId='';lastGame='';paintRoom()}});
 function element<K extends keyof HTMLElementTagNameMap>(tag:K,text='',parent?:HTMLElement){const e=document.createElement(tag);e.textContent=text;parent?.append(e);return e}
 function field(parent:HTMLElement,label:string,value:string,max=2048){const box=element('label',label,parent),input=element('input','',box);input.value=value;input.maxLength=max;return input}
 function button(parent:HTMLElement,label:string,action:()=>void){const b=element('button',label,parent);b.type='button';b.onclick=action;return b}
 function send(message:{type:string;[key:string]:unknown}){if(!client.send(message)){ctx.toast('还没有连接到双人房间。');return false}return true}
 function paintStatus(){const e=host?.querySelector<HTMLElement>('#online-status');if(e)e.textContent=({offline:'尚未连接',connecting:'正在连接服务器',connected:'已连接双人房间',reconnecting:'连接中断，正在重连',error:'连接失败'}[status])+(statusMessage?' · '+statusMessage:'');host?.querySelectorAll<HTMLButtonElement>('[data-connected]').forEach(b=>b.disabled=status!=='connected')}
 function receive(message:ServerMessage){
  if(message.type==='welcome'){playerId=message.playerId;if(snapshot?.roomId!==message.roomId){lastGame='';dirty=false;conflict=false;pendingText=undefined}}
  if(message.type==='welcome'||message.type==='snapshot'){
   snapshot=message.snapshot;
   if(pendingText!==undefined&&snapshot.document.text===pendingText){dirty=draft!==pendingText;pendingText=undefined;draftRevision=snapshot.document.revision}
   if(!dirty){draft=snapshot.document.text;draftRevision=snapshot.document.revision}
   else if(snapshot.document.revision!==draftRevision){conflict=true}
   paintRoom();ctx.onSnapshot?.(snapshot);
   if(snapshot.game&&!snapshot.game.finished){const id=snapshot.game.gameId+':'+snapshot.game.seed;if(lastGame!==id){lastGame=id;ctx.onGame?.(snapshot.game)}}
  }
  if(message.type==='event'&&message.event==='chat'){
   const data=message.data as {text?:unknown};if(typeof data?.text==='string'){chat.push({name:snapshot?.players.find(p=>p.id===message.playerId)?.name||'同行的人',text:data.text});if(chat.length>100)chat.shift();paintChat()}
  }
  if(message.type==='error'){pendingText=undefined;if(message.code==='CONFLICT')conflict=true;paintDocument();ctx.toast(message.message)}
  ctx.onMessage?.(message);
 }
 function paintChat(){const list=host?.querySelector<HTMLElement>('#online-chat-list');if(!list)return;list.replaceChildren();for(const item of chat)element('p',item.name+'：'+item.text,list);list.scrollTop=list.scrollHeight}
 function paintDocument(){if(!host)return;const input=host.querySelector<HTMLTextAreaElement>('#online-document');if(input&&document.activeElement!==input)input.value=draft;const latest=host.querySelector<HTMLElement>('#online-document-latest');if(latest)latest.textContent=snapshot?.document.text||'还没有写下文字。';const note=host.querySelector<HTMLElement>('#online-document-state');if(note)note.textContent=conflict?'对方已更新。你的草稿保留在上方；先查看最新文字，合并后再保存。':dirty?'草稿尚未共同保存。':'已与房间同步。';const save=host.querySelector<HTMLButtonElement>('#online-document-save');if(save)save.disabled=status!=='connected'||conflict||pendingText!==undefined}
 function paintRoom(){
  if(!host?.isConnected)return;const info=host.querySelector<HTMLElement>('#online-room-info');if(info)info.textContent=snapshot?'房间 '+snapshot.roomId+' · '+snapshot.players.map(p=>p.name+'（'+(p.role==='host'?'主玩家':'副玩家')+' · '+(p.connected?'在线':'暂离')+'）').join(' / '):'创建一个房间，或输入对方给你的房间号。';
  const controls=host.querySelector<HTMLElement>('#online-room-controls');if(controls){controls.replaceChildren();const me=snapshot?.players.find(p=>p.id===playerId);if(me?.role==='host')button(controls,'邀请副玩家跟随',()=>send({type:'follow-invite'}));if(me?.role==='guest'&&snapshot?.followInvitation){element('p','主玩家邀请你一起走。',controls);button(controls,'接受跟随',()=>send({type:'follow-answer',accept:true}));button(controls,'自己散步',()=>send({type:'follow-answer',accept:false}))}if(snapshot?.following)button(controls,'结束跟随',()=>send({type:'follow-stop'}));if(snapshot)element('p',snapshot.game?'共同小游戏：'+snapshot.game.gameId+(snapshot.game.finished?' · 已结束':' · 进行中'):'可以由主玩家发起共同小游戏。',controls)}
  paintStatus();paintDocument();
 }
 function openPanel(){
  ctx.open('<h2 id="modal-title">一起住进小屋</h2><div id="online-panel"></div>','online');host=document.getElementById('online-panel')!;host.className='online-panel';
  const connection=element('section','',host);element('h3','双人房间',connection);element('p','',connection).id='online-status';
  const server=field(connection,'服务器地址（留空使用默认）',addresses.server),defaults=field(connection,'默认服务器（留空使用网页同源）',addresses.defaultServer);server.placeholder='wss://你的服务器/online';
  button(connection,'保存服务器设置',()=>{addresses={server:server.value.trim(),defaultServer:defaults.value.trim()};try{localStorage.setItem(preferenceKey,JSON.stringify(addresses));ctx.toast('服务器设置已保存。')}catch{ctx.toast('浏览器无法保存设置。')}});
  const room=field(connection,'房间号','',16);room.autocomplete='off';
  const connect=(join:boolean)=>{try{addresses={server:server.value.trim(),defaultServer:defaults.value.trim()};client.connect(addresses.server,join?{type:'join',roomId:room.value.trim(),...ctx.profile(join?'guest':'host')}:{type:'create',...ctx.profile(join?'guest':'host')},location.href,addresses.defaultServer)}catch(e){ctx.toast(e instanceof Error?e.message:'连接地址有误')}};
  button(connection,'创建双人房间',()=>connect(false));button(connection,'加入房间',()=>{if(!room.value.trim()){ctx.toast('请填写房间号。');return}connect(true)});button(connection,'离开联机',()=>client.disconnect());element('p','',connection).id='online-room-info';element('div','',connection).id='online-room-controls';
  const chatBox=element('section','',host);element('h3','悄悄聊一会',chatBox);const messages=element('div','',chatBox);messages.id='online-chat-list';messages.setAttribute('role','log');messages.setAttribute('aria-live','polite');const text=field(chatBox,'聊天消息','',500);const sendChat=()=>{if(text.value.trim()&&send({type:'chat',text:text.value.trim()}))text.value=''};const chatButton=button(chatBox,'发送',sendChat);chatButton.dataset.connected='';text.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();sendChat()}};
  const paper=element('section','',host);element('h3','两个人一起写',paper);element('p','',paper).id='online-document-state';const area=element('textarea','',paper);area.id='online-document';area.setAttribute('aria-label','共同书写草稿');area.maxLength=10000;area.value=draft;area.oninput=()=>{draft=area.value;dirty=true;paintDocument()};const save=button(paper,'保存到共同信笺',()=>{pendingText=draft;if(!send({type:'document',revision:draftRevision,text:draft}))pendingText=undefined;paintDocument()});save.id='online-document-save';element('h4','对方最新保存的文字',paper);element('pre','',paper).id='online-document-latest';button(paper,'我已合并，使用最新版本保存',()=>{if(!snapshot)return;draftRevision=snapshot.document.revision;conflict=false;paintDocument()});
  const pet=element('section','',host);element('h3','随行的小精灵',pet);const select=element('select','',pet);select.setAttribute('aria-label','精灵种类');for(const [value,label]of [['firefly','萤火精灵'],['star','小星星'],['cat','小猫精灵']]){const o=element('option',label,select);o.value=value}const nickname=field(pet,'精灵昵称','小精灵',12);const myPet=snapshot?.players.find(p=>p.id===playerId)?.pet;if(myPet){select.value=myPet.kind;nickname.value=myPet.name}button(pet,'召唤精灵',()=>send({type:'pet',kind:select.value,name:nickname.value,enabled:true}));button(pet,'让精灵休息',()=>send({type:'pet',kind:select.value,name:nickname.value,enabled:false}));
  const games=element('section','',host);element('h3','一起玩一局',games);element('p','一起控制机关，合作打开礼物门。其他礼物玩法仍可各自重玩。',games);const gameSelect=element('select','',games);gameSelect.setAttribute('aria-label','共同小游戏');for(const [value,label]of [['mystery','双人开礼物门']]){const option=element('option',label,gameSelect);option.value=value}const start=button(games,'邀请一起玩',()=>{const me=snapshot?.players.find(p=>p.id===playerId);if(me?.role!=='host'){ctx.toast('请由主玩家发起共同小游戏。');return}if(snapshot?.players.filter(p=>p.connected).length!==2){ctx.toast('等另一位玩家进来，再一起开始。');return}send({type:'game-start',gameId:gameSelect.value})});start.dataset.connected='';
  button(host,'回到小屋',ctx.close);paintRoom();paintChat();paintStatus();
 }
 return{client,openPanel,getSnapshot:()=>snapshot,getPlayerId:()=>playerId};
}
