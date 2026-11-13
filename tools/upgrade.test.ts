import test from 'node:test';
import assert from 'node:assert/strict';
import {ActorController,sideBySide} from '../src/actors';
import {parseSave,defaults,save,restockSnack,useSnack} from '../src/state';
import {worlds,routeBetween} from '../src/world';
import {giftGames} from '../src/minigames';
test('version two imports clamp names, reject duplicate placements and preserve old unlocks',()=>{const s=parseSave(JSON.stringify({version:2,opened:['hat','hat'],inventory:['flower','hat'],placements:{'room:display':'flower','garden:display':'flower'},appearance:{girl:{hair:9,color:-5,skin:2,outfit:1}},names:{girl:'一二三四五六七八九十一二三四'},settings:{musicVolume:6}}));assert.equal(s.names.girl.length,12);assert.equal(s.appearance.girl.hair,3);assert.equal(s.settings.musicVolume,1);assert.equal(Object.keys(s.placements).length,1);assert.deepEqual(s.opened,['hat']);assert.equal(defaults().music,true);assert.equal(parseSave('{"version":1,"music":false,"opened":["hat"]}').music,false)});
test('cancelled movement callback cannot perform stale action',()=>{const c=new ActorController(),p={x:20,y:20},floor=(q:{x:number;y:number})=>q.x>0&&q.x<600&&q.y>0&&q.y<400;let called=0;c.move(p,{x:120,y:20},floor,()=>called++);for(let i=0;i<10;i++)c.update(p,.04,floor);const stopped={...p};c.cancel();for(let i=0;i<100;i++)c.update(p,.04,floor);assert.deepEqual(p,stopped);assert.equal(called,0);c.move(p,{x:90,y:50},floor,()=>called++);for(let i=0;i<100;i++)c.update(p,.04,floor);assert.equal(called,1)});
test('hand contact target is never placed in a blocked tile',()=>{const p={x:50,y:50};assert.equal(sideBySide(p,{x:70,y:50},()=>false),undefined);const side=sideBySide(p,{x:70,y:50},q=>q.x<=50);assert.ok(side&&side.x<50)});
test('all fifteen scenes have six activities, a reachable return and connected world route',()=>{assert.equal(Object.keys(worlds).length,18);for(const [id,w]of Object.entries(worlds)){assert.ok(w.items.length>=6,id);assert.ok(w.items.some(i=>i.to),id);assert.ok(routeBetween('room',id as keyof typeof worlds).length,id);for(const item of w.items)assert.ok(w.walkable({x:item.point[0],y:item.point[1]}),id+'/'+item.id)}});
test('twelve gifts have twelve distinct game definitions',()=>{assert.equal(Object.keys(giftGames).length,12);assert.equal(new Set(Object.values(giftGames).map(g=>g.title)).size,12)});
test('snack portions survive reload, preserve gifts and can be replenished',()=>{
 const original=structuredClone(save);
 try{
  Object.assign(save,parseSave('{"version":2,"opened":["chestnuts"],"inventory":["chestnuts"]}'));
  assert.equal(save.snackPortions.chestnuts,3);
  for(let i=0;i<3;i++)assert.equal(useSnack('chestnuts'),true);
  assert.equal(useSnack('chestnuts'),false);
  assert.ok(save.inventory.includes('chestnuts'));
  assert.ok(save.opened.includes('chestnuts'));
  Object.assign(save,parseSave(JSON.stringify(save)));
  assert.equal(save.snackPortions.chestnuts,0);
  restockSnack('chestnuts');
  assert.equal(save.snackPortions.chestnuts,3);
  assert.equal(save.inventory.filter(id=>id==='chestnuts').length,1);
 }finally{Object.assign(save,original)}
});
