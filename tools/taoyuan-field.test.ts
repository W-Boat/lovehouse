import test from 'node:test';import assert from 'node:assert/strict';
// @ts-ignore plain server module
import {RoomService} from '../server/rooms.mjs';
test('guest fields are limited, typed and relayed without arbitrary selectors',()=>{
 const service=new RoomService(),a:any[]=[],b:any[]=[];const sa=(x:any)=>a.push(x),sb=(x:any)=>b.push(x);service.receive('a',{type:'create',name:'主'},sa);service.receive('b',{type:'join',roomId:a[0].roomId,name:'副'},sb);
 const field={type:'taoyuan-field',route:'/game/farm',index:2,tag:'INPUT',inputType:'text',value:'一起种花',checked:false};
 service.receive('a',field,sa);assert.equal(a.at(-1).code,'FORBIDDEN');service.receive('b',field,sb);assert.equal(a.at(-1).event,'taoyuan-field');assert.equal(a.at(-1).data.value,'一起种花');assert.equal('selector' in a.at(-1).data,false);
 for(const override of [{inputType:'password'},{inputType:'file'},{inputType:'hidden'},{index:-1},{index:1001},{index:1.5},{tag:'DIV'},{tag:'TEXTAREA',inputType:'text'},{tag:'INPUT',inputType:'textarea'},{route:'/game-evil'},{value:'x'.repeat(10001)},{checked:'yes'}]){service.receive('b',{...field,...override},sb);assert.equal(b.at(-1).code,'TAOYUAN',JSON.stringify(override))}
 service.receive('b',{...field,tag:'TEXTAREA',inputType:'textarea'},sb);assert.equal(a.at(-1).data.tag,'TEXTAREA');service.receive('b',{...field,tag:'SELECT',inputType:'select-one'},sb);assert.equal(a.at(-1).data.tag,'SELECT');
 for(let i=0;i<30;i++)service.receive('b',field,sb);assert.equal(b.at(-1).code,'RATE_LIMIT');
});
