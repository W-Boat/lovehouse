import test from 'node:test';
import assert from 'node:assert/strict';
import {PlaceEffects,placeEvents} from '../src/place-effects';
import {worlds,type Zone} from '../src/world';
test('scene effects expire, replay on demand, and clear on zone change',()=>{
 let shapes=0;const g:any=new Proxy({},{get:(_t,k)=>()=>{if(String(k).startsWith('fill')||String(k).startsWith('stroke')||k==='lineBetween')shapes++;return g}});
 const scene:any={zone:'room',add:{graphics:()=>g},getItem:(id:string)=>worlds[scene.zone as Zone].items.find(i=>i.id===id)};const effects=new PlaceEffects(scene);
 assert.equal(effects.trigger('not-an-item'),false);assert.equal(effects.trigger('books'),true);effects.update(100);assert.ok(shapes>0);
 for(let i=0;i<75;i++)effects.update(100);shapes=0;effects.update(100);assert.equal(shapes,0);
 assert.equal(effects.trigger('books'),true);effects.update(100);assert.ok(shapes>0);shapes=0;scene.zone='pier';effects.update(100);assert.equal(shapes,0);
});
test('every registered effect belongs to a real scene object and each region has two different mechanisms',()=>{
 for(const [zone,entries]of Object.entries(placeEvents)){
  assert.ok(new Set(Object.values(entries)).size>=2,zone);
  for(const id of Object.keys(entries))assert.ok(worlds[zone as Zone].items.some(i=>i.id===id),zone+':'+id);
 }
});

test('tea feedback draws steam without painting solid blocks over the existing cups',()=>{
 let rectangles=0,lines=0;
 const g:any=new Proxy({},{get:(_target,key)=>()=>{if(key==='fillRect')rectangles++;if(key==='lineBetween')lines++;return g}});
 const scene:any={zone:'room',add:{graphics:()=>g},getItem:(id:string)=>worlds.room.items.find(item=>item.id===id)};
 const effect=new PlaceEffects(scene);assert.equal(effect.trigger('tea'),true);
 for(let i=0;i<30;i++)effect.update(100);
 assert.equal(rectangles,0);assert.ok(lines>0);
});

test('illustrated interactions use transparent prop textures and release them after feedback',()=>{
 const kinds=new Set(['book','bottle','water','photo','bell','stamp','toast','potion','chess','box','popcorn','candle','towel','vent']);
 for(const [zone,events]of Object.entries(placeEvents))for(const [id,kind]of Object.entries(events)){
  if(!kinds.has(kind))continue;
  let rectangles=0,created=0,destroyed=0;
  const g:any=new Proxy({},{get:(_t,key)=>()=>{if(key==='fillRect')rectangles++;return g}});
  const sprite:any=new Proxy({},{get:(_t,key)=>()=>{if(key==='destroy')destroyed++;return sprite}});
  const scene:any={zone,textures:{exists:()=>true,get:()=>({getSourceImage:()=>({width:40,height:32})})},add:{graphics:()=>g,image:(_x:number,_y:number,key:string)=>{assert.equal(key,'effect-'+kind);created++;return sprite}},getItem:(itemId:string)=>worlds[zone as Zone].items.find(item=>item.id===itemId)};
  const effect=new PlaceEffects(scene);assert.equal(effect.trigger(id),true);effect.update(100);
  assert.equal(created,1,zone+'/'+id);assert.equal(rectangles,0,zone+'/'+id);
  for(let i=0;i<75;i++)effect.update(100);
  assert.equal(destroyed,1,zone+'/'+id);
 }
});
