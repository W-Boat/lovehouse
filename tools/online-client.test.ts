import test from 'node:test';
import assert from 'node:assert/strict';
import {OnlineClient} from '../src/online-client';
class Socket{
 static instances:Socket[]=[];readyState=0;sent:string[]=[];
 onopen?:()=>void;onmessage?:(event:{data:string})=>void;onclose?:()=>void;onerror?:()=>void;
 constructor(readonly url:string){Socket.instances.push(this)}
 send(value:string){this.sent.push(value)}close(){this.readyState=3;this.onclose?.()}
 open(){this.readyState=1;this.onopen?.()}message(value:unknown){this.onmessage?.({data:JSON.stringify(value)})}
}
test('connection waits for a real welcome and obsolete sockets cannot change the current room',()=>{
 const events:unknown[]=[],client=new OnlineClient(message=>events.push(message),()=>{},Socket as any);
 assert.equal(client.send({type:'chat',text:'hello'}),false);
 client.connect('wss://room.example/',{type:'create',name:'你'},'https://game.example/');
 const old=Socket.instances.at(-1)!;old.open();assert.equal(JSON.parse(old.sent[0]).type,'create');assert.equal(client.state,'connecting');
 client.connect('wss://room.example/',{type:'join',roomId:'ABC123',name:'我'},'https://game.example/');
 old.message({type:'welcome',roomId:'STALE',token:'old'});assert.equal(events.length,0);
 const current=Socket.instances.at(-1)!;current.open();current.message({type:'welcome',roomId:'ABC123',token:'private'});
 assert.equal(client.state,'connected');assert.equal(client.send({type:'chat',text:'你好'}),true);
 client.disconnect();assert.equal(client.state,'offline');assert.equal(JSON.parse(current.sent.at(-1)!).type,'leave');
 current.message({type:'welcome',roomId:'ABC123',token:'private'});assert.equal(events.length,1);
});
