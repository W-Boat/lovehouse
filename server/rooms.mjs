import {changeQuiz,publicQuiz} from './quiz.mjs';
import {randomBytes} from 'node:crypto';
const zones=new Set('room garden forest pier greenhouse memory station postoffice aquarium camp magic haunted cinema ferris mars hotspring market aurora taoyuan'.split(' '));
const games=new Set('moon keychain chestnuts earphones band doll chocolate letter notes hat labubu mystery'.split(' '));
const secret=()=>randomBytes(18).toString('base64url');
const clean=(v,n)=>typeof v==='string'?v.replace(/[\u0000-\u001f]/g,'').trim().slice(0,n):'';
export class RoomService{
 constructor({now=Date.now,reconnectMs=120000,maxRooms=1000}={}){this.now=now;this.reconnectMs=reconnectMs;this.maxRooms=maxRooms;this.rooms=new Map();this.clients=new Map()}
 snapshot(r){return{roomId:r.id,serverNow:this.now(),affection:r.affection??null,taoyuan:r.taoyuan,quiz:publicQuiz(r.quiz),players:[...r.players.values()].map(({token,send,expires,rates,...p})=>p),document:r.document,game:r.game,following:r.following,followInvitation:r.followInvitation}}
 broadcast(r){for(const p of r.players.values())if(p.connected)p.send({type:'snapshot',snapshot:this.snapshot(r)})}
 event(r,p,event,data){for(const member of r.players.values())if(member.connected)member.send({type:'event',event,playerId:p.id,data})}
 disconnect(client){const entry=this.clients.get(client);if(!entry)return;const{r,p}=entry;this.clients.delete(client);p.connected=false;r.affection=null;p.expires=this.now()+this.reconnectMs;r.following=false;r.followInvitation=false;this.broadcast(r)}
 sweep(){for(const [id,r]of this.rooms){for(const [pid,p]of r.players)if(!p.connected&&p.expires<=this.now()){r.players.delete(pid);r.quiz=null;}if(!r.players.size)this.rooms.delete(id);else this.broadcast(r)}}
 receive(client,message,send){
 const fail=(code,message)=>send({type:'error',code,message,requestId:typeof message?.requestId==='string'?message.requestId.slice(0,64):undefined});
 if(!message||typeof message!=='object'||typeof message.type!=='string')return fail('INVALID','消息格式无效');
 const m=message;let entry=this.clients.get(client);
 if(['create','join','resume'].includes(m.type)){
  if(entry)return fail('ALREADY_JOINED','请先离开当前房间');this.sweep();let r,p;
  if(m.type==='create'){
   if(this.rooms.size>=this.maxRooms)return fail('CAPACITY','服务器房间已满');
   const id=randomBytes(9).toString('base64url');r={id,players:new Map(),document:{revision:0,text:''},game:null,following:false,followInvitation:false};this.rooms.set(id,r);
  }else{r=this.rooms.get(m.roomId);if(!r)return fail('ROOM_NOT_FOUND','房间不存在或已结束')}
  if(m.type==='resume'){
   p=[...r.players.values()].find(p=>p.token===m.token);if(!p)return fail('BAD_TOKEN','重连凭证无效');if(p.connected)return fail('IN_USE','这个身份正在另一处使用');
  }else{
   const name=clean(m.name,12);if(!name){if(!r.players.size)this.rooms.delete(r.id);return fail('NAME','请填写称呼')}
   if(r.players.size>=2)return fail('ROOM_FULL','房间已有两位玩家');
   const role=m.type==='create'?'host':'guest';if([...r.players.values()].some(p=>p.role===role))return fail('RESERVED','该位置等待原玩家重连');
   const appearance={};for(const key of ['hair','color','skin','outfit']){const n=m.appearance?.[key],max={hair:3,color:5,skin:3,outfit:2}[key];appearance[key]=Number.isInteger(n)&&n>=0&&n<=max?n:0}
   p={id:secret(),role,name,appearance,position:{zone:'room',x:320,y:356,direction:0},pet:{kind:'firefly',name:'小萤',enabled:false},rates:new Map(),token:secret()};r.players.set(p.id,p);
  }
  p.send=send;p.connected=true;p.expires=Infinity;this.clients.set(client,{r,p});send({type:'welcome',roomId:r.id,playerId:p.id,role:p.role,token:p.token,snapshot:this.snapshot(r),requestId:m.requestId});this.broadcast(r);return;
 }
 if(!entry)return fail('NOT_JOINED','请先加入房间');const{r,p}=entry;
 const rate=(key,limit,window=1000)=>{const t=this.now();let value=p.rates.get(key);if(!value||t-value.t>=window){value={t,n:0};p.rates.set(key,value)}return ++value.n<=limit};
 if(!rate('all',80))return fail('RATE_LIMIT','操作太快，请稍等');
 if(r.affection&&r.affection.expires<this.now()){if(r.affection.kind==='hand')r.following=false;r.affection=null;this.broadcast(r)}
 if(['quiz-invite','quiz-cancel','quiz-accept','quiz-publish','quiz-answer','quiz-next'].includes(m.type)){
  if(!rate('quiz',8))return fail('RATE_LIMIT','答题操作太快，请稍等');
  const reason=changeQuiz(r,p,m,this.now());
  if(reason)return fail('QUIZ',reason);
  this.broadcast(r);return;
 }
 switch(m.type){
 case 'affection-invite':{if(!['hand','hug'].includes(m.kind)||r.affection||r.following)return fail('AFFECTION','请先结束当前互动');const members=[...r.players.values()];if(members.length!==2||members.some(v=>!v.connected||v.position.zone!==m.zone))return fail('AFFECTION','请先来到同一区域');const valid=q=>q&&[q.x,q.y].every(Number.isFinite)&&q.x>=0&&q.x<=640&&q.y>=0&&q.y<=427;if(!valid(m.host)||!valid(m.guest)||Math.hypot(m.host.x-m.guest.x,m.host.y-m.guest.y)<16||Math.hypot(m.host.x-m.guest.x,m.host.y-m.guest.y)>64)return fail('AFFECTION','接触位置无效');r.affection={id:secret(),kind:m.kind,from:p.id,zone:m.zone,host:{x:m.host.x,y:m.host.y},guest:{x:m.guest.x,y:m.guest.y},phase:'invited',ready:[],expires:this.now()+30000};break}
 case 'affection-answer':{const a=r.affection;if(!a||a.id!==m.id||a.from===p.id||a.phase!=='invited'||typeof m.accept!=='boolean')return fail('AFFECTION','邀请已失效');if(!m.accept){r.affection=null;break}a.phase='approaching';a.expires=this.now()+30000;break}
 case 'affection-ready':{const a=r.affection;if(!a||a.id!==m.id||a.phase!=='approaching')return fail('AFFECTION','互动已失效');const target=a[p.role];if(p.position.zone!==a.zone||Math.hypot(p.position.x-target.x,p.position.y-target.y)>6)return fail('AFFECTION','请先走到约定位置');if(!a.ready.includes(p.id))a.ready.push(p.id);if(a.ready.length===2){a.phase='playing';if(a.kind==='hand')r.following=true;a.startedAt=this.now()+250;a.expires=this.now()+(a.kind==='hug'?5000:600000)}break}
 case 'affection-cancel':if(r.affection?.id===m.id){if(r.affection.kind==='hand')r.following=false;r.affection=null;}break;
 case 'leave':r.affection=null;r.quiz=null;this.clients.delete(client);r.players.delete(p.id);r.following=false;r.followInvitation=false;if(!r.players.size)this.rooms.delete(r.id);else this.broadcast(r);return;
 case 'move':if(!rate('move',30))return;if(!zones.has(m.zone)||![m.x,m.y,m.direction].every(Number.isFinite)||m.x<0||m.x>640||m.y<0||m.y>427||!Number.isInteger(m.direction)||m.direction<0||m.direction>3)return fail('POSITION','位置无效');if(r.affection){const a=r.affection;if(a.kind==='hand'&&a.phase==='playing'&&r.following){if(p.role==='host'&&a.zone!==m.zone){a.zone=m.zone;this.broadcast(r)}}else if(m.zone!==a.zone||(a.phase==='playing'&&Math.hypot(m.x-a[p.role].x,m.y-a[p.role].y)>8)){r.affection=null;this.broadcast(r)}}p.position={zone:m.zone,x:m.x,y:m.y,direction:m.direction,pose:clean(m.pose,32)};this.event(r,p,'move',p.position);return;
 case 'chat':{const text=clean(m.text,500);if(!text)return fail('TEXT','消息不能为空');if(!rate('chat',5,10000))return fail('RATE_LIMIT','说慢一点');this.event(r,p,'chat',{text,at:this.now()});return}
 case 'follow-stop':if(r.affection?.kind==='hand')r.affection=null;r.followInvitation=false;r.following=false;break;
 case 'follow-invite':if(p.role!=='host')return fail('FORBIDDEN','仅主玩家可以邀请跟随');r.affection=null;r.followInvitation=true;r.following=false;break;
 case 'follow-answer':if(p.role!=='guest'||!r.followInvitation||typeof m.accept!=='boolean')return fail('FORBIDDEN','没有待回应的邀请');r.followInvitation=false;r.following=m.accept;break;
 case 'document':if(!rate('document',10))return fail('RATE_LIMIT','书写太快');if(m.revision!==r.document.revision){send({type:'snapshot',snapshot:this.snapshot(r)});return fail('CONFLICT','对方已修改，请合并最新内容后保存')}if(typeof m.text!=='string'||m.text.length>10000)return fail('TEXT','文字超出长度');r.document={revision:r.document.revision+1,text:m.text};break;
 case 'game-start':if(p.role!=='host')return fail('FORBIDDEN','请由主玩家发起小游戏');if(!games.has(m.gameId))return fail('GAME','小游戏不存在');r.game={gameId:m.gameId,seed:Number.isSafeInteger(m.seed)?m.seed:Math.floor(Math.random()*2147483647),revision:0,finished:false};break;
 case 'game-action':if(!r.game||r.game.finished||r.game.gameId!==m.gameId)return fail('GAME','小游戏尚未开始');if(JSON.stringify(m.action??null).length>4096)return fail('GAME','操作数据过大');r.game.revision++;this.event(r,p,'game-action',{gameId:m.gameId,action:m.action,revision:r.game.revision});return;
 case 'game-finish':if(p.role!=='host'||!r.game||r.game.gameId!==m.gameId)return fail('FORBIDDEN','仅主玩家确认游戏结果');if(r.game.finished)return;r.game.finished=true;r.game.result=clean(m.result,64);break;
 case 'equipment':if(!['hat','earphones','band'].every(k=>typeof m[k]==='boolean'))return fail('EQUIPMENT','装备设置无效');p.equipment={hat:m.hat,earphones:m.earphones,band:m.band};break;
 case 'taoyuan-state':if(p.role!=='host')return fail('FORBIDDEN','仅主玩家保存共同田庄');if(!rate('taoyuan-state',2))return fail('RATE_LIMIT','田庄保存太快');if(typeof m.save!=='string'||m.save.length>2000000||!m.save.length||typeof m.route!=='string'||m.route.length>160||!m.route.startsWith('/game'))return fail('TAOYUAN','田庄状态无效');r.taoyuan={save:m.save,route:m.route,revision:(r.taoyuan?.revision??0)+1};this.event(r,p,'taoyuan-state',r.taoyuan);return;
 case 'taoyuan-field':if(p.role!=='guest')return fail('FORBIDDEN','表单协作由副玩家请求');if(!rate('taoyuan-field',20))return fail('RATE_LIMIT','输入太快');if(typeof m.route!=='string'||m.route.length>160||!m.route.startsWith('/game')||!Number.isInteger(m.index)||m.index<0||m.index>1000||!['INPUT','TEXTAREA','SELECT'].includes(m.tag)||typeof m.inputType!=='string'||!['text','number','checkbox','radio','range','email','url','tel','search','date','time','color','select-one','select-multiple','textarea'].includes(m.inputType)||typeof m.value!=='string'||m.value.length>10000||typeof m.checked!=='boolean'||!/^\/game(?:[/?]|$)/.test(m.route)||(m.tag==='INPUT'&&['textarea','select-one','select-multiple'].includes(m.inputType))||(m.tag==='TEXTAREA'&&m.inputType!=='textarea')||(m.tag==='SELECT'&&m.inputType!=='select-one'))return fail('TAOYUAN','田庄表单无效');this.event(r,p,'taoyuan-field',{route:m.route,index:m.index,tag:m.tag,inputType:m.inputType,value:m.value,checked:m.checked});return;
 case 'taoyuan-action':if(p.role!=='guest')return fail('FORBIDDEN','协作操作由副玩家请求');if(!rate('taoyuan-action',10))return fail('RATE_LIMIT','田庄操作太快');if(typeof m.route!=='string'||m.route.length>160||!m.route.startsWith('/game')||!Number.isInteger(m.index)||m.index<0||m.index>1000||typeof m.text!=='string'||m.text.length>200)return fail('TAOYUAN','田庄操作无效');this.event(r,p,'taoyuan-action',{route:m.route,index:m.index,text:m.text});return;
 case 'pet':if(!['firefly','star','cat'].includes(m.kind)||typeof m.enabled!=='boolean')return fail('PET','宠物设置无效');p.pet={kind:m.kind,name:clean(m.name,12)||'小精灵',enabled:m.enabled};break;
 default:return fail('INVALID','不支持的消息');
 }
 this.broadcast(r);
 }
}
