import * as interactionTargets from '../src/interaction-targets';
import * as appearanceColors from '../src/appearance-colors';
import * as wearableArt from '../src/wearable-art';
import * as calendar from '../src/calendar';
import * as atlas from '../src/atlas';
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
import {textureFiles,additionalTextureFiles} from '../src/assets';
import {defaults} from '../src/state';
import {gameViewport,localPoint,localDelta,requestImmersive} from '../src/viewport';
function loadScene(clock?:{now:()=>number},state=defaults()){
 const code=transformSync(readFileSync('src/scene.ts','utf8'),{loader:'ts',format:'cjs',target:'es2022'}).code;
 const output={exports:{} as any};
 class Scene{sys={};}
 const dependencies:Record<string,unknown>={'./interaction-targets':interactionTargets,phaser:{__esModule:true,default:{Scene,Math:{Clamp:(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v))}}},'./signals':{Signals},'../content/birthday-config':{birthdayConfig},'./state':{save:state,persist:()=>{}},'./navigation':navigation,'./hand-formation':handFormation,'./window-weather':windowWeather,'./layouts':layouts,'./world':world,'./follow':follow,'./actors':actors,'./online-pets':{OnlinePets:class{update(){}}},'./calendar':calendar,'./wearable-art':wearableArt,'./place-effects':{PlaceEffects:class{trigger(){return false};update(){};rebuild(){}}},'./seat-layers':{SeatLayers:class{rebuild(){};update(){}}},'./appearance-colors':appearanceColors,'./atlas':atlas,'./window-view':{WindowView:class{update(){}}},'./world-motion':{WorldMotion:class{rebuild(){};update(){}}},'./outdoor-environment':{OutdoorEnvironment:class{update(){}}},'./assets':{textureFiles,additionalTextureFiles,coreTextureKeys:['room','room-after','hero','characters','gifts','props','sitting','cake','girl-actions','boy-actions','icons-v2','gifts-v2','girl-walk','boy-walk'],assetUrl:(name:string)=>'/birthday/assets/'+name}};
 vm.runInNewContext(code,{...(clock?{performance:clock}:{}),module:output,exports:output.exports,require:(id:string)=>{if(!(id in dependencies))throw new Error(id);return dependencies[id]}});
 const scene=new output.exports.Cottage();
 scene.textures={exists:()=>false};
 return scene;
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
  const scene=loadScene(),w=world.worlds[zone];scene.zone=zone;scene.player=fakeObject(...w.spawn);scene.boy=fakeObject(...w.boy);const original=[scene.player.x,scene.player.y,scene.boy.x,scene.boy.y];scene.setPose=()=>{};scene.renderMoving=()=>{};scene.prepareSeatArt=async()=>{};scene.sit(seat);for(let i=0;i<800;i++)scene.updateSeated(.04);assert.equal(scene.seated,seat);assert.notDeepEqual([scene.player.x,scene.player.y,scene.boy.x,scene.boy.y],original);scene.stand();for(let i=0;i<20;i++)scene.updateSeated(.04);assert.equal(scene.seated,'');assert.ok(w.walkable(scene.player));assert.ok(w.walkable(scene.boy));
 }
});
test('scheduled interaction never fires remotely and fires once the player arrives',()=>{
 const scene=loadScene();scene.player=fakeObject(320,350);scene.blocked=false;const item=world.worlds.room.items.find(i=>i.id==='chair-left')!;let count=0;scene.bridge.on('interact',()=>count++);scene.approach(item);const callback=scene.pending;assert.equal(typeof callback,'function');callback();assert.equal(count,0);scene.player.setPosition(...item.point);callback();assert.equal(count,1);
});

test('superseded scene loads and fade callbacks cannot commit stale destinations',async()=>{
 const scene=loadScene(),loading=new Map<string,()=>void>(),listeners=new Map<string,Set<()=>void>>(),commits:string[]=[],done:string[]=[];
 scene.ensureZone=(zone:string)=>new Promise<void>(resolve=>loading.set(zone,resolve));scene.resizeView=()=>{};scene.changeZone=(zone:string)=>{commits.push(zone);scene.zone=zone};
 const camera={once(event:string,fn:()=>void){if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event)!.add(fn)},off(event:string,fn:()=>void){listeners.get(event)?.delete(fn)},fadeOut(){},fadeIn(){}};scene.cameras={main:camera};
 const emit=(event:string)=>{const callbacks=[...(listeners.get(event)??[])];listeners.delete(event);callbacks.forEach(fn=>fn())};
 const old=scene.transitionTo('memory',()=>done.push('memory')),latest=scene.transitionTo('magic',()=>done.push('magic'));loading.get('memory')!();await old;assert.equal(listeners.get('camerafadeoutcomplete')?.size??0,0);loading.get('magic')!();await latest;
 const newest=scene.transitionTo('aurora',()=>done.push('aurora'));assert.equal(listeners.get('camerafadeoutcomplete')?.size??0,0);loading.get('aurora')!();await newest;emit('camerafadeoutcomplete');emit('camerafadeincomplete');
 assert.deepEqual(commits,['aurora']);assert.deepEqual(done,['aurora']);assert.equal(scene.transitioning,false);assert.equal(scene.blocked,false);
});
test('a failed obsolete load does not unblock a newer transition',async()=>{
 const scene=loadScene(),requests=new Map<string,{resolve:()=>void;reject:()=>void}>();scene.cameras={main:{fadeIn(){},once(){},off(){},fadeOut(){}}};scene.ensureZone=(zone:string)=>new Promise<void>((resolve,reject)=>requests.set(zone,{resolve,reject}));let errors=0;scene.bridge.on('zone-error',()=>errors++);
 const old=scene.transitionTo('memory',()=>{}),latest=scene.transitionTo('aurora',()=>{});requests.get('memory')!.reject();await old;assert.equal(scene.transitioning,true);assert.equal(scene.blocked,true);assert.equal(errors,0);requests.get('aurora')!.reject();await latest;assert.equal(scene.transitioning,false);assert.equal(scene.blocked,false);assert.equal(errors,1);
});


test('registered seats anchor both hips and preserve reachable standing positions',()=>{
 for(const definition of [...layouts.backgroundSeats,...Object.entries(layouts.furnishings).flatMap(([zone,props])=>props.filter(p=>p.hips).map(p=>({...p,zone})))]){
  const scene=loadScene(),zone=definition.zone as world.Zone,w=world.worlds[zone];scene.zone=zone;scene.player=fakeObject(...w.spawn);scene.boy=fakeObject(...w.boy);scene.prepareSeatArt=async()=>{};scene.setPose=()=>{};scene.renderMoving=()=>{};
  scene.textures={exists:()=>false,get:()=>({getSourceImage:()=>({width:40,height:64})})};scene.sit(definition.id);assert.equal(scene.seated,definition.id,definition.id);
  for(let i=0;i<1600;i++)scene.updateSeated(.04);
  assert.equal(scene.player.x,definition.hips![0],definition.id);assert.equal(scene.boy.x,definition.hips![2],definition.id);
  scene.stand();for(let i=0;i<40;i++)scene.updateSeated(.04);assert.equal(scene.seated,'',definition.id);assert.ok(w.walkable(scene.player),definition.id+' girl');assert.ok(w.walkable(scene.boy),definition.id+' boy');
 }
});

test('drawn sitting transition keeps aspect ratio and reverses frames on rising',()=>{
 const scene=loadScene(),selected:string[]=[];scene.zone='room';scene.appearanceKey=(_who:string,key:string)=>key;
 const actor={texture:{getSourceImage:()=>({width:25,height:50})},setTexture(key:string){selected.push(key);return this},setDisplaySize(w:number,h:number){assert.equal(w/h,.5);return this}};
 scene.textures={exists:()=>true,get:()=>({getSourceImage:()=>({width:32,height:64})})};scene.transitionSeatPose(actor,'girl',.1);scene.transitionSeatPose(actor,'girl',.9);scene.transitionSeatPose(actor,'girl',.1);
 assert.deepEqual(selected,['girl-sitmove-0','girl-sitmove-5','girl-sitmove-0']);
});


test('network seating retains every legacy seat for both roles without moving the remote actor',()=>{
 for(const role of ['host','guest'])for(const zone of Object.keys(world.worlds) as world.Zone[]){
  const sample=loadScene();for(const item of world.worlds[zone].items){if(!sample.legacySeats[item.id]&&!layouts.seatDefinition(zone,item.id))continue;
   const scene=loadScene(),w=world.worlds[zone];scene.zone=zone;scene.player=fakeObject(...w.spawn);scene.boy=fakeObject(...w.boy);scene.textures={get:()=>({getSourceImage:()=>({width:40,height:64})})};scene.onlineWorld={active:true,role,local:role==='host'?scene.player:scene.boy,cancelFollowing(){},cancelAffection(){}};
   const remote=role==='host'?scene.boy:scene.player,original={x:remote.x,y:remote.y};scene.sit(item.id);assert.equal(scene.seated,item.id,role+':'+item.id);assert.ok(scene.onlineSeat,role+':'+item.id);assert.deepEqual({x:remote.x,y:remote.y},original);scene.stand();assert.equal(scene.onlineSeat.standing,true);
  }
 }
});


test('equipment images bind after replacement gift atlases, never to destroyed frames',()=>{
 const scene=loadScene();let generation=1;const equipped:any[]=[];
 scene.textures={exists:()=>true};scene.sliceAtlas=()=>{};scene.buildActionFrames=()=>{generation=2};
 scene.add={image:(x:number,y:number,key:string)=>{const object=fakeObject(x,y);if(key==='gift-hat'||key==='gift-earphones')equipped.push({key,generation});return object},graphics:fakeObject,ellipse:fakeObject,rectangle:fakeObject,text:fakeObject,container:fakeObject};
 scene.input={keyboard:{addKeys:()=>({}),on:()=>{}}};scene.cameras={main:fakeObject()};scene.cameras.main.width=844;scene.cameras.main.height=390;
 scene.create();assert.deepEqual(equipped,[{key:'gift-hat',generation:2},{key:'gift-earphones',generation:2}]);
});

test('calendar follows visible elapsed time across slow frames and excludes suspended time',()=>{
 const state=defaults();calendar.enableCalendar(state.calendar,true);state.calendar.timeMode='auto';state.calendar.timeScale=60;state.calendar.minutes=1439;
 let now=0;const scene=loadScene({now:()=>now},state);scene.entered=true;
 scene.updateCalendar(16);now=1000;scene.updateCalendar(16);
 assert.equal(state.calendar.date,'2026-10-24');assert.equal(state.calendar.minutes,0);
 scene.calendarPaused=true;now=60000;scene.updateCalendar(16);
 assert.equal(state.calendar.minutes,0);
 scene.calendarPaused=false;scene.resetCalendarClock();now=61000;scene.updateCalendar(16);
 assert.equal(state.calendar.minutes,0);
 now=62000;scene.updateCalendar(16);assert.equal(state.calendar.minutes,1);
});


test('ambiguous touch stops prior travel, exposes both targets, and does not trigger either',()=>{
 const scene=loadScene();scene.blocked=false;scene.entered=true;scene.player=fakeObject(320,350);scene.boy=fakeObject(360,330);
 scene.objects=[{id:'tea',name:'tea',x:100,y:100,point:[100,120]},{id:'book',name:'book',x:120,y:100,point:[120,120]}];
 let ids:string[]=[],approaches=0;scene.approach=()=>approaches++;scene.bridge.on('interaction-choices',(items:any[])=>ids=items.map(i=>i.id));
 scene.walk({x:400,y:350});assert.ok(scene.path.length);scene.tapWorld(109,100,1,true);
 assert.deepEqual(ids,['tea','book']);assert.equal(approaches,0);assert.equal(scene.path.length,0);
 scene.tapWorld(100,100,1,true);assert.equal(approaches,1);
});
