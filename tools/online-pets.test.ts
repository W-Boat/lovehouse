import test from 'node:test';
import assert from 'node:assert/strict';
import {visiblePets,petTarget} from '../src/online-pets';
import type {PlayerState} from '../src/online-protocol';
test('pet visibility follows owner connection, scene and equipment without exposing a third avatar',()=>{
 const p={id:'a',role:'host',connected:true,position:{zone:'room',x:1,y:2},pet:{kind:'cat',name:'猫',enabled:true}} as PlayerState;
 assert.deepEqual(visiblePets([p],'room'),[p]);
 for(const v of [{...p,connected:false},{...p,position:{...p.position,zone:'garden'}},{...p,pet:{...p.pet,enabled:false}},{...p,pet:{...p.pet,kind:'unknown'}}])assert.equal(visiblePets([v],'room').length,0);
 assert.equal(visiblePets([p,{...p,id:'b',role:'guest',pet:{...p.pet,kind:'star'}}],'room').length,2);
});
test('visual follower targets do not mutate owner coordinates and respect reduced motion',()=>{
 const owner={x:100,y:200},before={...owner};const a=petTarget(owner,'host',0,false),b=petTarget(owner,'guest',1,false);
 assert.ok(a.x<owner.x);assert.ok(b.x>owner.x);assert.deepEqual(owner,before);
 assert.deepEqual(petTarget(owner,'host',0,true),petTarget(owner,'host',99,true));
 assert.notEqual(petTarget(owner,'host',0,false).y,petTarget(owner,'host',1,false).y);
});
