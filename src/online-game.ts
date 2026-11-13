import type {OnlineClient} from './online-client';
import type {RoomSnapshot,ServerMessage} from './online-protocol';
/** Each player controls three switches. Only the host resolves the shared lock. */
export function installOnlineGame(ctx:{client:OnlineClient;open:(html:string,kind?:string)=>void;close:()=>void;getSnapshot:()=>RoomSnapshot|undefined;getPlayerId:()=>string}){
 let game:NonNullable<RoomSnapshot['game']>|undefined,round=0,bits=[0,0],host:HTMLElement|undefined;
 const me=()=>ctx.getSnapshot()?.players.find(p=>p.id===ctx.getPlayerId());
 const target=(side:number)=>1+((Math.abs(game?.seed??0)+round*13+side*3)%7);
 function sendState(){ctx.client.send({type:'game-action',gameId:'mystery',action:{kind:'state',seed:game?.seed,round,bits}})}
 function paint(){if(!host?.isConnected||!game)return;host.replaceChildren();const title=document.createElement('h2');title.textContent='双人礼物门 · 第 '+Math.min(3,round+1)+' 道机关';host.append(title);
  const help=document.createElement('p');help.textContent='各自调整自己的三盏灯，让左右两边都与目标图样相同。亮灯为开，暗灯为关。';host.append(help);
  for(let side=0;side<2;side++){const panel=document.createElement('section'),label=document.createElement('h3');label.textContent=side?'副玩家的星灯':'主玩家的星灯';panel.append(label);const goal=document.createElement('p');goal.textContent='目标：'+[0,1,2].map(i=>target(side)&1<<i?'亮':'暗').join(' · ');panel.append(goal);
   for(let i=0;i<3;i++){const b=document.createElement('button');b.textContent=`${i+1}号灯：${bits[side]&1<<i?'亮':'暗'}`;b.setAttribute('aria-pressed',String(Boolean(bits[side]&1<<i)));b.disabled=game.finished||round>=3||(me()?.role==='host'?0:1)!==side;b.onclick=()=>ctx.client.send({type:'game-action',gameId:'mystery',action:{kind:'toggle',index:i,round,seed:game?.seed}});panel.append(b)}host.append(panel)}
  const status=document.createElement('p');status.textContent=game.finished||round>=3?'礼物门打开了，谢谢你和我一起。':'等两侧图样都正确，机关就会一起亮起。';status.setAttribute('role','status');host.append(status);const close=document.createElement('button');close.textContent='回到小屋';close.onclick=ctx.close;host.append(close);
 }
 function start(value:NonNullable<RoomSnapshot['game']>){game=value;round=0;bits=[0,0];ctx.open('<div id="online-game-host"></div>','online-game');host=document.getElementById('online-game-host')!;paint();if(me()?.role==='host')sendState();else ctx.client.send({type:'game-action',gameId:'mystery',action:{kind:'request-state',seed:value.seed}})}
 function handleMessage(message:ServerMessage){
  if(!game)return;
  if(message.type==='snapshot'&&message.snapshot.game?.seed===game.seed){game=message.snapshot.game;paint();return}
  if(message.type!=='event'||message.event!=='game-action')return;const data=message.data as any,action=data?.action;
  if(data?.gameId!=='mystery'||!action||action.seed!==game.seed)return;
  const actor=ctx.getSnapshot()?.players.find(p=>p.id===message.playerId);if(!actor)return;
  if(action.kind==='request-state'&&me()?.role==='host'){sendState();return}
  if(action.kind==='state'&&actor.role==='host'&&me()?.role!=='host'){
   if(Number.isInteger(action.round)&&action.round>=round&&action.round<=3&&Array.isArray(action.bits)&&action.bits.length===2&&action.bits.every((v:unknown)=>Number.isInteger(v)&&Number(v)>=0&&Number(v)<=7)){round=action.round;bits=action.bits;paint()}return;
  }
  if(action.kind==='toggle'&&me()?.role==='host'&&action.round===round&&round<3&&Number.isInteger(action.index)&&action.index>=0&&action.index<3){
   const side=actor.role==='host'?0:1;bits[side]^=1<<action.index;
   if(bits[0]===target(0)&&bits[1]===target(1)){round++;bits=[0,0]}
   sendState();paint();if(round===3)ctx.client.send({type:'game-finish',gameId:'mystery',result:'双人合作打开三道礼物门'});
  }
 }
 return{start,handleMessage};
}
