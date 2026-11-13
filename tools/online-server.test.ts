import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore server is intentionally plain Node ESM.
import {RoomService} from '../server/rooms.mjs';
test('two private seats, resumable identity, permissions and document CAS',()=>{
 let now=0;const s=new RoomService({now:()=>now}),a:any[]=[],b:any[]=[],c:any[]=[];
 s.receive('a',{type:'create',name:'主'},(v:any)=>a.push(v));const welcome=a[0];
 s.receive('b',{type:'join',roomId:welcome.roomId,name:'副'},(v:any)=>b.push(v));
 s.receive('c',{type:'join',roomId:welcome.roomId,name:'三'},(v:any)=>c.push(v));assert.equal(c.at(-1).code,'ROOM_FULL');
 s.receive('b',{type:'follow-invite'},(v:any)=>b.push(v));assert.equal(b.at(-1).code,'FORBIDDEN');
 s.receive('a',{type:'follow-invite'},(v:any)=>a.push(v));s.receive('b',{type:'follow-answer',accept:true},(v:any)=>b.push(v));assert.equal(b.at(-1).snapshot.following,true);
 s.receive('a',{type:'document',revision:0,text:'一起写'},(v:any)=>a.push(v));s.receive('b',{type:'document',revision:0,text:'旧稿'},(v:any)=>b.push(v));assert.equal(b.at(-1).code,'CONFLICT');assert.equal(a.at(-1).snapshot.document.text,'一起写');
 s.disconnect('a');s.receive('again',{type:'resume',roomId:welcome.roomId,token:welcome.token},(v:any)=>c.push(v));assert.equal(c.at(-2).playerId,welcome.playerId);assert.equal(JSON.stringify(s.snapshot(s.rooms.get(welcome.roomId))).includes(welcome.token),false);
 s.disconnect('again');now=120001;s.sweep();s.receive('bad',{type:'resume',roomId:welcome.roomId,token:welcome.token},(v:any)=>c.push(v));assert.equal(c.at(-1).code,'BAD_TOKEN');
});
test('chat limits, coordinates and game event ordering are checked',()=>{
 const s=new RoomService(),a:any[]=[],b:any[]=[];s.receive('a',{type:'create',name:'主'},(v:any)=>a.push(v));s.receive('b',{type:'join',roomId:a[0].roomId,name:'副'},(v:any)=>b.push(v));
 s.receive('a',{type:'move',zone:'room',x:NaN,y:2,direction:0},(v:any)=>a.push(v));assert.equal(a.at(-1).code,'POSITION');
 for(let i=0;i<6;i++)s.receive('b',{type:'chat',text:'你好'},(v:any)=>b.push(v));assert.equal(b.at(-1).code,'RATE_LIMIT');
 s.receive('a',{type:'game-start',gameId:'moon',seed:42},(v:any)=>a.push(v));s.receive('b',{type:'game-action',gameId:'moon',action:{piece:1}},(v:any)=>b.push(v));assert.equal(a.at(-1).event,'game-action');assert.equal(a.at(-1).data.revision,1);
 s.receive('b',{type:'game-finish',gameId:'moon',result:'win'},(v:any)=>b.push(v));assert.equal(b.at(-1).code,'FORBIDDEN');
});

test('CI: two real WebSocket clients share chat and document updates',{skip:process.env.CI!=='true'},async()=>{
 const {createOnlineServer}=await import('../server/index.mjs');const {WebSocket}=await import('ws');
 const {server}=createOnlineServer();await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address() as any;
 const clients:any[]=[];const received:any[][]=[[],[]];
 try{
  const health=await fetch(`http://127.0.0.1:${address.port}/health`);assert.equal(health.status,200);
  for(let i=0;i<2;i++){const ws=new WebSocket(`ws://127.0.0.1:${address.port}/online`);clients.push(ws);ws.on('message',(raw:any)=>received[i].push(JSON.parse(raw.toString())));await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject)})}
  async function wait(check:()=>boolean){for(let i=0;i<100;i++){if(check())return;await new Promise(r=>setTimeout(r,20))}throw Error('Network event timeout')}
  clients[0].send(JSON.stringify({type:'create',name:'主'}));await wait(()=>received[0].some(m=>m.type==='welcome'));const roomId=received[0].find(m=>m.type==='welcome').roomId;
  clients[1].send(JSON.stringify({type:'join',roomId,name:'副'}));await wait(()=>received[1].some(m=>m.type==='welcome'));
  clients[1].send(JSON.stringify({type:'chat',text:'真的连接了'}));await wait(()=>received[0].some(m=>m.event==='chat'&&m.data.text==='真的连接了'));
  clients[0].send(JSON.stringify({type:'document',revision:0,text:'一起写下'}));await wait(()=>received[1].some(m=>m.snapshot?.document?.text==='一起写下'));
 }finally{for(const ws of clients)ws.terminate();await new Promise<void>(r=>server.close(()=>r()))}
});
