import test from 'node:test';
import assert from 'node:assert/strict';
import {worlds} from '../src/world';
import {findPath,segmentWalkable,advanceAlong,moveWithCollision,type Point} from '../src/navigation';
import {FootstepFollower} from '../src/follow';
import {parseSave} from '../src/state';
const openFloors={room:[{x:455,y:245},{x:476,y:150},{x:192,y:235},{x:600,y:245}],garden:[{x:204,y:206},{x:352,y:220},{x:430,y:255}],forest:[{x:265,y:235},{x:370,y:245},{x:290,y:280},{x:250,y:310}],pier:[{x:222,y:283},{x:395,y:237},{x:552,y:286}]} as const;
test('visible open floor areas are walkable beyond the old narrow center lines',()=>{for(const [zone,points] of Object.entries(openFloors)){const w=worlds[zone as keyof typeof worlds],start={x:w.spawn[0],y:w.spawn[1]};for(const p of points){assert.ok(w.walkable(p),zone+' '+JSON.stringify(p));assert.ok(findPath(start,p,w.walkable).length)}}});
test('every path edge and every actor step stays on floor, including obstacle corners',()=>{for(const w of Object.values(worlds)){for(const item of w.items){const actor={x:w.spawn[0],y:w.spawn[1]},path=findPath(actor,{x:item.point[0],y:item.point[1]},w.walkable);for(let i=1;i<path.length;i++)assert.ok(segmentWalkable(path[i-1],path[i],w.walkable));let n=0;while(path.length&&n++<2000){const before={...actor};advanceAlong(actor,path,3.36,w.walkable);assert.ok(segmentWalkable(before,actor,w.walkable))}assert.ok(n<2000,item.id+' finishes');assert.ok(Math.hypot(actor.x-item.point[0],actor.y-item.point[1])<.1,item.id+' exact arrival')}}});
test('joystick slides against furniture and does not tunnel through a corner',()=>{const w=worlds.room.walkable,actor={x:228,y:175};for(let i=0;i<40;i++){const before={...actor};moveWithCollision(actor,3.2,3.2,w);assert.ok(w(actor));assert.ok(segmentWalkable(before,actor,w))}assert.equal(w({x:320,y:200}),false);assert.equal(worlds.garden.walkable({x:590,y:170}),false)});
test('following uses the player footsteps around the cake in the room and catches up when she stops',()=>{
 const w=worlds.room.walkable,leader={x:320,y:350},boy={x:350,y:350},follow=new FootstepFollower();follow.setEnabled(true,leader,boy,w);const path=findPath(leader,{x:320,y:144},w);let distance=0;
 for(let i=0;path.length&&i<3000;i++){advanceAlong(leader,path,1.4,w);const old={...boy};distance+=follow.update(boy,leader,1/60,w);assert.ok(segmentWalkable(old,boy,w));assert.ok(w(boy))}
 for(let i=0;i<180;i++)follow.update(boy,leader,1/60,w);
 assert.ok(distance>170);assert.ok(Math.hypot(leader.x-boy.x,leader.y-boy.y)<=31);const stop={...boy};for(let i=0;i<60;i++)follow.update(boy,leader,1/60,w);assert.ok(Math.hypot(boy.x-stop.x,boy.y-stop.y)<.01);
});
test('follow persists through pauses and scene changes; old saves default to waiting',()=>{
 assert.equal(parseSave('{"version":1}').following,false);assert.equal(parseSave('{"version":1,"following":true}').following,true);
 const f=new FootstepFollower(),leader={x:320,y:350},boy={x:360,y:350};f.setEnabled(true,leader,boy,worlds.room.walkable);const before={...boy};f.update(boy,leader,1,worlds.room.walkable,true);assert.deepEqual(boy,before);assert.equal(f.enabled,true);
 const world=worlds.forest;leader.x=320;leader.y=382;boy.x=336;boy.y=369;f.reset(leader,boy,world.walkable);const path=findPath(leader,{x:320,y:174},world.walkable);let moved=0;while(path.length){advanceAlong(leader,path,1.4,world.walkable);moved+=f.update(boy,leader,1/60,world.walkable)}assert.ok(moved>100);assert.ok(world.walkable(boy));assert.equal(f.enabled,true);
});
test('all sampled walkable floor cells belong to a single navigable component in each scene',()=>{
 for(const [name,w]of Object.entries(worlds)){const cells=new Set<number>();for(let y=0;y<427;y+=4)for(let x=0;x<640;x+=4)if(w.walkable({x,y}))cells.add(y*1000+x);const total=cells.size,queue=[cells.values().next().value!];cells.delete(queue[0]);for(let n=0;n<queue.length;n++){const k=queue[n],x=k%1000,y=Math.floor(k/1000);for(const[dx,dy]of[[4,0],[-4,0],[0,4],[0,-4]]){const next=(y+dy)*1000+x+dx;if(cells.has(next)&&segmentWalkable({x,y},{x:x+dx,y:y+dy},w.walkable)){cells.delete(next);queue.push(next)}}}assert.equal(queue.length,total,name+' has no isolated floor pockets')}
});
