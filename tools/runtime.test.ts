import * as handFormation from '../src/hand-formation';
import * as windowWeather from '../src/window-weather';
import * as layouts from '../src/layouts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {transformSync} from 'esbuild';
import {Signals} from '../src/signals';
import {birthdayConfig} from '../content/birthday-config';
import * as navigation from '../src/navigation';
import * as world from '../src/world';
import * as follow from '../src/follow';
import * as actors from '../src/actors';
import {textureFiles} from '../src/assets';
import {defaults} from '../src/state';
import {gameViewport,localPoint,localDelta,requestImmersive} from '../src/viewport';
function loadScene(){
 const code=transformSync(readFileSync('src/scene.ts','utf8'),{loader:'ts',format:'cjs',target:'es2022'}).code;
 const output={exports:{} as any};
 class Scene{sys={};}
 const dependencies:Record<string,unknown>={phaser:{__esModule:true,default:{Scene,Math:{Clamp:(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v))}}},'./signals':{Signals},'../content/birthday-config':{birthdayConfig},'./state':{save:defaults(),persist:()=>{}},'./navigation':navigation,'./hand-formation':handFormation,'./window-weather':windowWeather,'./layouts':layouts,'./world':world,'./follow':follow,'./actors':actors,'./world-motion':{WorldMotion:class{rebuild(){};update(){}}},'./assets':{textureFiles,coreTextureKeys:['room','room-after','hero','characters','gifts','props','sitting','cake','girl-actions','boy-actions','icons-v2','gifts-v2','girl-walk','boy-walk'],assetUrl:(name:string)=>'/birthday/assets/'+name}};
 vm.runInNewContext(code,{module:output,exports:output.exports,require:(id:string)=>{if(!(id in dependencies))throw new Error(id);return dependencies[id]}});
 return new output.exports.Cottage();
}
function fakeObject(x=0,y=0){const target:any={x,y,width:0,height:0,visible:true};const proxy=new Proxy(target,{get:(t,key)=>key in t?t[key]:(...args:any[])=>{if(key==='setPosition'){t.x=args[0];t.y=args[1]}if(key==='setZoom')t.zoom=args[0];return proxy}});return proxy}
test('cold boot: UI can subscribe before Phaser injects plugins; create releases entry gate',()=>{
 const scene=loadScene();assert.equal(scene.events,undefined);let ready=false;scene.bridge.on('cottage-ready',()=>{ready=true});assert.equal(ready,false);
 scene.textures={exists:()=>true};scene.sliceAtlas=()=>{};scene.buildActionFrames=()=>{};scene.add={image:fakeObject,graphics:fakeObject,ellipse:fakeObject,rectangle:fakeObject,text:fakeObject,container:fakeObject};scene.input={keyboard:{addKeys:()=>({}),on:()=>{}}};scene.cameras={main:fakeObject()};scene.cameras.main.width=844;scene.cameras.main.height=390;
 scene.create();assert.equal(ready,true);assert.ok(scene.player);assert.equal(scene.entered,false);scene.enter();assert.equal(scene.entered,true);assert.equal(scene.blocked,false);
});
test('NPC approach schedules interaction only after arrival',()=>{
 const scene=loadScene();scene.player=fakeObject(50,200);scene.boy=fakeObject(360,330);const item={id:'boy',name:'boy',x:360,y:314,point:[332,330]};let pending:any='unset',triggered=0;scene.walk=(_p:any,callback:any)=>{pending=callback};scene.bridge.on('interact',()=>triggered++);scene.blocked=false;
 scene.approach(item);assert.equal(typeof pending,'function');assert.equal(triggered,0);scene.player.setPosition(332,330);scene.approach(item);assert.equal(triggered,1);
});
test('portrait fallback rotates the game and correctly maps scene taps and joystick vectors',()=>{
 const p=gameViewport(390,844);assert.deepEqual(p,{width:844,height:390,rotated:true});const rect={left:0,top:0,width:390,height:844};assert.deepEqual(localPoint(390,0,rect,p),{x:0,y:0});assert.deepEqual(localPoint(0,844,rect,p),{x:844,y:390});assert.deepEqual(localPoint(195,422,rect,p),{x:422,y:195});assert.deepEqual(localDelta(12,30,true),{x:30,y:-12});const landscape=gameViewport(844,390);assert.deepEqual(localPoint(422,195,{left:0,top:0,width:844,height:390},landscape),{x:422,y:195});
});
test('fullscreen and orientation rejection both recover without blocking entry',async()=>{
 const calls:string[]=[];const result=await requestImmersive({requestFullscreen:async()=>{calls.push('fullscreen');throw new Error('in-app browser')}},{lock:async()=>{calls.push('orientation');throw new Error('unsupported')}});assert.deepEqual(calls,['fullscreen','orientation']);assert.deepEqual(result,{fullscreen:false,landscape:false});
 const success=await requestImmersive({requestFullscreen:async()=>{}},{lock:async()=>{}});assert.deepEqual(success,{fullscreen:true,landscape:true});
});
test('doorway and keepsake are reachable from inside and outside',()=>{
 for(const [start,end,walkable] of [[{x:320,y:356},{x:320,y:379},navigation.roomWalkable],[{x:155,y:365},{x:459,y:245},navigation.gardenWalkable]] as const){const path=navigation.findPath(start,end,walkable);assert.ok(path.length);assert.ok(path.every(walkable))}
});
test('far clicks schedule interaction, and a new floor click cancels it',()=>{
 const scene=loadScene();scene.player=fakeObject(320,350);scene.blocked=false;let opened=0;scene.bridge.on('interact',()=>opened++);
 const gift={...birthdayConfig.gifts[0]};scene.approach(gift);assert.equal(opened,0);assert.ok(scene.movingTo);assert.equal(typeof scene.pending,'function');
 scene.player.setPosition(gift.point[0],gift.point[1]);scene.approach(gift);assert.equal(opened,1);
 scene.player.setPosition(320,350);scene.approach(world.worlds.room.items.find(i=>i.id==='door'));assert.equal(opened,1);assert.equal(scene.movingTo.id,'door');
 scene.entered=true;scene.tapWorld(440,320);assert.equal(scene.movingTo,undefined);
});
test('missing or failed textures never create a placeholder scene or emit ready',()=>{
 const scene=loadScene();let ready=0,errors=0,draws=0;scene.bridge.on('cottage-ready',()=>ready++);scene.bridge.on('asset-error',()=>errors++);scene.textures={exists:(key:string)=>key!=='room'};scene.add={image:()=>{draws++;throw new Error('should not draw')}};scene.create();scene.enter();assert.equal(ready,0);assert.equal(errors,1);assert.equal(draws,0);assert.equal(scene.entered,false);assert.equal(scene.blocked,true);
 const loadSceneFailure=loadScene();loadSceneFailure.failedAssets.add('garden');loadSceneFailure.textures={exists:()=>true};loadSceneFailure.bridge.on('cottage-ready',()=>ready++);loadSceneFailure.create();assert.equal(ready,0);
});

test('new scene seats restore both actors to reachable floor on standing',()=>{
 for(const [zone,seat]of [['station','station-seat'],['postoffice','postal-seat'],['aquarium','aquarium-seat'],['camp','camp-seat']] as const){
  const scene=loadScene(),w=world.worlds[zone];scene.zone=zone;scene.player=fakeObject(...w.spawn);scene.boy=fakeObject(...w.boy);const original=[scene.player.x,scene.player.y,scene.boy.x,scene.boy.y];scene.setPose=()=>{};scene.sit(seat);for(let i=0;i<800;i++)scene.updateSeated(.04);assert.equal(scene.seated,seat);assert.notDeepEqual([scene.player.x,scene.player.y,scene.boy.x,scene.boy.y],original);scene.stand();for(let i=0;i<20;i++)scene.updateSeated(.04);assert.equal(scene.seated,'');assert.ok(w.walkable(scene.player));assert.ok(w.walkable(scene.boy));
 }
});
test('scheduled interaction never fires remotely and fires once the player arrives',()=>{
 const scene=loadScene();scene.player=fakeObject(320,350);scene.blocked=false;const item=world.worlds.room.items.find(i=>i.id==='chair-left')!;let count=0;scene.bridge.on('interact',()=>count++);scene.approach(item);const callback=scene.pending;assert.equal(typeof callback,'function');callback();assert.equal(count,0);scene.player.setPosition(...item.point);callback();assert.equal(count,1);
});
