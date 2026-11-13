import {createOnlineQuiz} from './online-quiz';
import {uiCopy,htmlCopy,formatCopy} from '../content/ui-copy';
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
 function send(message:{type:string;[key:string]:unknown}){if(!client.send(message)){ctx.toast(uiCopy('online.disconnected'));return false}return true}
 const quiz=createOnlineQuiz(send);
 function paintStatus(){quiz.update(snapshot,playerId,status==='connected');const e=host?.querySelector<HTMLElement>('#online-status');if(e)e.textContent=({offline:uiCopy('online.status.offline'),connecting:uiCopy('online.status.connecting'),connected:uiCopy('online.status.connected'),reconnecting:uiCopy('online.status.reconnecting'),error:uiCopy('online.status.error')}[status])+(statusMessage?' · '+statusMessage:'');host?.querySelectorAll<HTMLButtonElement>('[data-connected]').forEach(b=>b.disabled=status!=='connected')}
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
   const data=message.data as {text?:unknown};if(typeof data?.text==='string'){chat.push({name:snapshot?.players.find(p=>p.id===message.playerId)?.name||uiCopy('online.companion'),text:data.text});if(chat.length>100)chat.shift();paintChat()}
  }
  if(message.type==='error'){pendingText=undefined;if(message.code==='CONFLICT')conflict=true;paintDocument();ctx.toast(message.message)}
  ctx.onMessage?.(message);
 }
 function paintChat(){const list=host?.querySelector<HTMLElement>('#online-chat-list');if(!list)return;list.replaceChildren();for(const item of chat)element('p',item.name+'：'+item.text,list);list.scrollTop=list.scrollHeight}
 function paintDocument(){if(!host)return;const input=host.querySelector<HTMLTextAreaElement>('#online-document');if(input&&document.activeElement!==input)input.value=draft;const latest=host.querySelector<HTMLElement>('#online-document-latest');if(latest)latest.textContent=snapshot?.document.text||uiCopy('online.document.empty');const note=host.querySelector<HTMLElement>('#online-document-state');if(note)note.textContent=conflict?uiCopy('online.document.conflict'):dirty?uiCopy('online.document.dirty'):uiCopy('online.document.synced');const save=host.querySelector<HTMLButtonElement>('#online-document-save');if(save)save.disabled=status!=='connected'||conflict||pendingText!==undefined}
 function paintRoom(){
  if(!host?.isConnected)return;const info=host.querySelector<HTMLElement>('#online-room-info');if(info)info.textContent=snapshot?formatCopy('online.room.summary',{room:snapshot.roomId,players:snapshot.players.map(p=>p.name+'（'+(p.role==='host'?uiCopy('online.role.host'):uiCopy('online.role.guest'))+' · '+(p.connected?uiCopy('online.presence.online'):uiCopy('online.presence.away'))+'）').join(' / ')}):uiCopy('online.room.help');
  const controls=host.querySelector<HTMLElement>('#online-room-controls');if(controls){controls.replaceChildren();const me=snapshot?.players.find(p=>p.id===playerId);if(me?.role==='host')button(controls,uiCopy('online.follow.invite'),()=>send({type:'follow-invite'}));if(me?.role==='guest'&&snapshot?.followInvitation){element('p',uiCopy('online.follow.incoming'),controls);button(controls,uiCopy('online.follow.accept'),()=>send({type:'follow-answer',accept:true}));button(controls,uiCopy('online.follow.decline'),()=>send({type:'follow-answer',accept:false}))}if(snapshot?.following)button(controls,uiCopy('online.follow.stop'),()=>send({type:'follow-stop'}));if(snapshot)element('p',snapshot.game?formatCopy('online.game.summary',{game:snapshot.game.gameId,state:snapshot.game.finished?uiCopy('online.game.finished'):uiCopy('online.game.playing')}):uiCopy('online.game.host-help'),controls)}
  const invitation=host.querySelector<HTMLElement>('#online-quiz-invitation');
  if(invitation)invitation.textContent=snapshot?.quiz?.phase==='invited'&&snapshot.quiz.responder===playerId?uiCopy('quiz.invitation-short'):'';
  paintStatus();paintDocument();
 }
 function openPanel(){
  ctx.open(`<h2 id="modal-title">${htmlCopy('online.title')}</h2><div id="online-panel"></div>`,'online');host=document.getElementById('online-panel')!;host.className='online-panel';
  const connection=element('section','',host);element('h3',uiCopy('online.room.title'),connection);element('p','',connection).id='online-status';
  const server=field(connection,uiCopy('online.server.label'),addresses.server),defaults=field(connection,uiCopy('online.server.default-label'),addresses.defaultServer);server.placeholder=uiCopy('online.server.placeholder');
  button(connection,uiCopy('online.server.save'),()=>{addresses={server:server.value.trim(),defaultServer:defaults.value.trim()};try{localStorage.setItem(preferenceKey,JSON.stringify(addresses));ctx.toast(uiCopy('online.server.saved'))}catch{ctx.toast(uiCopy('online.server.storage-error'))}});
  const room=field(connection,uiCopy('online.room.code'),'',16);room.autocomplete='off';
  const connect=(join:boolean)=>{try{addresses={server:server.value.trim(),defaultServer:defaults.value.trim()};client.connect(addresses.server,join?{type:'join',roomId:room.value.trim(),...ctx.profile(join?'guest':'host')}:{type:'create',...ctx.profile(join?'guest':'host')},location.href,addresses.defaultServer)}catch(e){ctx.toast(e instanceof Error?e.message:uiCopy('online.server.invalid'))}};
  button(connection,uiCopy('online.room.create'),()=>connect(false));button(connection,uiCopy('online.room.join'),()=>{if(!room.value.trim()){ctx.toast(uiCopy('online.room.missing-code'));return}connect(true)});button(connection,uiCopy('online.leave'),()=>client.disconnect());element('p','',connection).id='online-room-info';element('div','',connection).id='online-room-controls';
  const quizLink=button(connection,uiCopy('quiz.open'),()=>host?.querySelector('#online-quiz')?.scrollIntoView({block:'start'}));quizLink.dataset.connected='';
  const invitation=element('p','',connection);invitation.id='online-quiz-invitation';invitation.setAttribute('role','status');
  const chatBox=element('section','',host);element('h3',uiCopy('online.chat.title'),chatBox);const messages=element('div','',chatBox);messages.id='online-chat-list';messages.setAttribute('role','log');messages.setAttribute('aria-live','polite');const text=field(chatBox,uiCopy('online.chat.message'),'',500);const sendChat=()=>{if(text.value.trim()&&send({type:'chat',text:text.value.trim()}))text.value=''};const chatButton=button(chatBox,uiCopy('online.chat.send'),sendChat);chatButton.dataset.connected='';text.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();sendChat()}};
  const paper=element('section','',host);element('h3',uiCopy('online.document.title'),paper);element('p','',paper).id='online-document-state';const area=element('textarea','',paper);area.id='online-document';area.setAttribute('aria-label',uiCopy('online.document.draft'));area.maxLength=10000;area.value=draft;area.oninput=()=>{draft=area.value;dirty=true;paintDocument()};const save=button(paper,uiCopy('online.document.save'),()=>{pendingText=draft;if(!send({type:'document',revision:draftRevision,text:draft}))pendingText=undefined;paintDocument()});save.id='online-document-save';element('h4',uiCopy('online.document.latest'),paper);element('pre','',paper).id='online-document-latest';button(paper,uiCopy('online.document.merge'),()=>{if(!snapshot)return;draftRevision=snapshot.document.revision;conflict=false;paintDocument()});
  const pet=element('section','',host);element('h3',uiCopy('online.pet.title'),pet);const select=element('select','',pet);select.setAttribute('aria-label',uiCopy('online.pet.kind'));for(const [value,label]of [['firefly',uiCopy('online.pet.firefly')],['star',uiCopy('online.pet.star')],['cat',uiCopy('online.pet.cat')]]){const o=element('option',label,select);o.value=value}const nickname=field(pet,uiCopy('online.pet.nickname'),uiCopy('online.pet.default-name'),12);const myPet=snapshot?.players.find(p=>p.id===playerId)?.pet;if(myPet){select.value=myPet.kind;nickname.value=myPet.name}button(pet,uiCopy('online.pet.summon'),()=>send({type:'pet',kind:select.value,name:nickname.value,enabled:true}));button(pet,uiCopy('online.pet.rest'),()=>send({type:'pet',kind:select.value,name:nickname.value,enabled:false}));
  const games=element('section','',host);element('h3',uiCopy('online.game.title'),games);element('p',uiCopy('online.game.help'),games);const gameSelect=element('select','',games);gameSelect.setAttribute('aria-label',uiCopy('online.game.select'));for(const [value,label]of [['mystery',uiCopy('online.game.mystery')]]){const option=element('option',label,gameSelect);option.value=value}const start=button(games,uiCopy('online.game.invite'),()=>{const me=snapshot?.players.find(p=>p.id===playerId);if(me?.role!=='host'){ctx.toast(uiCopy('online.game.host-only'));return}if(snapshot?.players.filter(p=>p.connected).length!==2){ctx.toast(uiCopy('online.game.wait'));return}send({type:'game-start',gameId:gameSelect.value})});start.dataset.connected='';
  quiz.mount(host);
  button(host,uiCopy('online.return'),ctx.close);paintRoom();paintChat();paintStatus();
 }
 return{client,openPanel,getSnapshot:()=>snapshot,getPlayerId:()=>playerId};
}
