import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomService} from '../server/rooms.mjs';
test('Taoyuan host state survives reconnect and guest cannot overwrite it',()=>{
 const service=new RoomService(),host={},guest={},h:any[]=[],g:any[]=[];
 service.receive(host,{type:'create',name:'甲'},(m:any)=>h.push(m));const welcome=h.find(m=>m.type==='welcome');
 service.receive(guest,{type:'join',roomId:welcome.roomId,name:'乙'},(m:any)=>g.push(m));
 service.receive(host,{type:'taoyuan-state',save:'encrypted-test',route:'/game/farm'},(m:any)=>h.push(m));
 assert.equal(service.snapshot(service.rooms.get(welcome.roomId)).taoyuan.revision,1);
 service.receive(guest,{type:'taoyuan-state',save:'malicious',route:'/game/farm'},(m:any)=>g.push(m));assert.equal(g.at(-1).code,'FORBIDDEN');
 service.receive(guest,{type:'taoyuan-action',route:'/game/farm',index:3,text:'浇水'},(m:any)=>g.push(m));assert.ok(h.some(m=>m.event==='taoyuan-action'&&m.data.text==='浇水'));
 service.disconnect(host);const restored:any[]=[];service.receive({}, {type:'resume',roomId:welcome.roomId,token:welcome.token},(m:any)=>restored.push(m));assert.equal(restored[0].snapshot.taoyuan.save,'encrypted-test');
});
test('Taoyuan rejects oversized state and invalid collaboration targets',()=>{
 const service=new RoomService(),h:any[]=[],g:any[]=[],host={},guest={};service.receive(host,{type:'create',name:'甲'},(m:any)=>h.push(m));service.receive(guest,{type:'join',roomId:h[0].roomId,name:'乙'},(m:any)=>g.push(m));
 service.receive(host,{type:'taoyuan-state',save:'a'.repeat(2000001),route:'/game/farm'},(m:any)=>h.push(m));assert.equal(h.at(-1).code,'TAOYUAN');
 service.receive(guest,{type:'taoyuan-action',route:'javascript:alert(1)',index:-1,text:'x'},(m:any)=>g.push(m));assert.equal(g.at(-1).code,'TAOYUAN');
});
