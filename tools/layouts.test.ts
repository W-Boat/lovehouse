import test from 'node:test';
import assert from 'node:assert/strict';
import {furnishings} from '../src/layouts';
import {worlds,type Zone} from '../src/world';
import {findPath} from '../src/navigation';
import {windowPanes,windowContains,renderWindowWeather} from '../src/window-weather';
import {HandFormation} from '../src/hand-formation';
test('hand formation approaches without teleporting and yields at a narrow passage',()=>{
 const formation=new HandFormation(),leader={x:100,y:100},boy={x:160,y:100},floor=(p:{x:number;y:number})=>p.x>0&&p.x<300&&p.y>0&&p.y<200;
 for(let i=0;i<60;i++){const before={...boy};formation.update(boy,leader,1/60,floor);assert.ok(Math.hypot(boy.x-before.x,boy.y-before.y)<2)}
 assert.equal(formation.active,true);assert.equal(boy.x,128);
 const before={...boy};assert.equal(formation.update(boy,leader,1/60,p=>floor(p)&&p.x<115),false);assert.equal(formation.active,false);assert.deepEqual(boy,before);
 formation.reset();assert.equal(formation.active,false);
});
test('central furnishings have reachable interactions and block their physical bases',()=>{
 for(const [zone,props]of Object.entries(furnishings)){
  const world=worlds[zone as Zone];
  for(const prop of props){if(prop.floor)continue;const item=world.items.find(i=>i.id===prop.id)!;assert.ok(item,zone+'/'+prop.id);assert.ok(findPath({x:world.spawn[0],y:world.spawn[1]},{x:item.point[0],y:item.point[1]},world.walkable).length,prop.id+' reachable');assert.equal(world.walkable({x:prop.x,y:prop.y}),false,prop.id+' has a solid base')}
  assert.ok(props.some(p=>p.hips),'central furniture includes real paired seats');
 }
});
test('indoor rain and snow remain inside glass panes and clear removes particles',()=>{
 for(const zone of Object.keys(windowPanes) as Zone[])for(const weather of ['rain','snow','clear']){
  const drops:{x:number;y:number;h:number}[]=[];const graphics={fillStyle(){},fillPoints(){},fillCircle(){},fillRect(x:number,y:number,w:number,h:number){drops.push({x,y,h})}};
  renderWindowWeather(graphics as any,zone,weather,'day',4.2);
  if(weather==='clear')assert.equal(drops.length,0);
  for(const d of drops){assert.ok(windowContains(zone,d.x,d.y),zone);assert.ok(windowContains(zone,d.x,d.y+d.h),zone+' frame protected')}
 }
 assert.equal(windowContains('room',320,55),false,'central mullion stays untouched');
 assert.equal(windowContains('room',320,300),false,'floor stays dry');
});
