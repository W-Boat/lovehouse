import test from 'node:test';import assert from 'node:assert/strict';import {interactionTargets,hintPosition} from '../src/interaction-targets';
test('touch targets retain their physical reach across camera and UI scales',()=>{
 for(const unit of [.25,1,3]){const items=[{id:'tea',x:100,y:100}];assert.equal(interactionTargets(items,{x:100+26*unit,y:100},unit,true)[0]?.id,'tea');assert.equal(interactionTargets(items,{x:100+30*unit,y:100},unit,true).length,0)}
});
test('precise taps are direct, ambiguous gaps offer nearest choices, unrelated objects stay excluded',()=>{
 const items=[{id:'tea',x:100,y:100},{id:'book',x:120,y:100},{id:'door',x:160,y:100}];
 assert.deepEqual(interactionTargets(items,{x:101,y:100},1,true).map(i=>i.id),['tea']);assert.deepEqual(interactionTargets(items,{x:109,y:100},1,true).map(i=>i.id),['tea','book']);assert.deepEqual(interactionTargets(items,{x:150,y:100},1,true).map(i=>i.id),['door']);
});
test('short cues stay within the viewport and below the toolbar',()=>{const p=hintPosition({x:-20,y:0},390,844,220,32);assert.ok(p.x>=118);assert.ok(p.y-32>=80);const q=hintPosition({x:800,y:900},390,844,220,32);assert.ok(q.x+110<=382);assert.ok(q.y<=772)});

test('overlapping centers still offer both objects',()=>{assert.equal(interactionTargets([{id:'photo',x:100,y:100},{id:'door',x:103,y:100}],{x:100,y:100},1,true).length,2)});

test('nearby cues avoid the map and toolbar, or hide if no free space remains',()=>{
 const map={left:12,top:90,right:110,bottom:202},p=hintPosition({x:70,y:150},844,390,200,32,[map]);
 assert.equal(p.hidden,false);assert.ok(p.y-32>=map.bottom+6||p.x-100>=map.right+6);
 assert.equal(hintPosition({x:100,y:100},390,390,200,32,[{left:0,top:0,right:390,bottom:390}]).hidden,true);
});
