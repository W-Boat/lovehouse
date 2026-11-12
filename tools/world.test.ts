import test from 'node:test';
import assert from 'node:assert/strict';
import {worlds,entrySpawn,inReach,actionLabel,type Zone} from '../src/world';
import {findPath} from '../src/navigation';
import {parseSave} from '../src/state';
import {places} from '../content/places';
test('every location and every portal is reachable within its own scene',()=>{
 for(const [id,world] of Object.entries(worlds)){
  const start={x:world.spawn[0],y:world.spawn[1]};assert.ok(world.walkable(start),id+' spawn');assert.ok(world.walkable({x:world.boy[0],y:world.boy[1]}),id+' companion spawn');
  for(const item of world.items){const end={x:item.point[0],y:item.point[1]};assert.ok(world.walkable(end),id+'/'+item.id+' approach');const path=findPath(start,end,world.walkable);assert.ok(path.length,id+'/'+item.id+' path');assert.ok(path.every(world.walkable));assert.ok(Math.hypot(path.at(-1)!.x-end.x,path.at(-1)!.y-end.y)<12)}
 }
});
test('scene graph is fully connected with a path back and safe arrival points',()=>{
 const seen=new Set<Zone>(['room']),queue:Zone[]=['room'];while(queue.length){const from=queue.shift()!;for(const item of worlds[from].items){if(!item.to)continue;const spawn=entrySpawn(from,item.to);assert.ok(worlds[item.to].walkable({x:spawn[0],y:spawn[1]}),from+' -> '+item.to);if(!seen.has(item.to)){seen.add(item.to);queue.push(item.to)}}}assert.equal(seen.size,18);
 for(const zone of ['forest','pier'] as const)assert.ok(worlds[zone].items.some(item=>item.to==='garden'));
});
test('interaction prompt only appears in range and has an explicit local verb',()=>{
 const telescope=worlds.pier.items.find(i=>i.id==='telescope')!;assert.equal(inReach({x:177,y:383},telescope),false);assert.equal(inReach({x:474,y:221},telescope),true);assert.equal(actionLabel(telescope,false),'看星星');const gift={id:'hat',name:'hat',x:50,y:50,point:[100,100] as [number,number]};assert.equal(actionLabel(gift,false),'拆开');assert.equal(actionLabel(gift,true),'重看');
});
test('existing saves migrate without losing gifts and new moments stay bounded',()=>{
 const old=parseSave('{"version":1,"opened":["hat"],"hat":true}');assert.deepEqual(old.opened,['hat']);assert.deepEqual(old.moments,[]);assert.equal(old.hat,true);
 const updated=parseSave(JSON.stringify({version:1,moments:['lanterns','lanterns',null,12,'<script>','starlight']}));assert.deepEqual(updated.moments,['lanterns','starlight']);
});
test('all atmospheric content corresponds to an actual local object',()=>{
 const ids=new Set(Object.values(worlds).flatMap(w=>w.items.map(i=>i.id)));for(const id of Object.keys(places))assert.ok(ids.has(id),id);assert.equal(worlds.pier.walkable({x:630,y:200}),false);assert.equal(worlds.forest.walkable({x:30,y:200}),false);
});
