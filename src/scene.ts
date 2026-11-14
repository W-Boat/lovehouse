import {CloudMotion} from './cloud-motion';
import {preparedResource} from './release-resources';
import {loadCloudBackground} from './cloud-background';
import {interactionTargets} from './interaction-targets';
import {recolorAppearance,captureRaisedHands,restoreRaisedHands} from './appearance-colors';
import type {AffectionState} from './online-protocol';
import {PlaceEffects,effectFrames} from './place-effects';
import {OnlinePets} from './online-pets';
import type {OnlineWorld} from './online-world';
import {drawEarphones,drawHat} from './wearable-art';
import {OutdoorEnvironment} from './outdoor-environment';
import {advanceCalendar,calendarSnapshot,type CalendarSnapshot} from './calendar';
import {SeatLayers} from './seat-layers';
import {isolateFurniture} from './atlas';
import {WindowView} from './window-view';
import {HandFormation} from './hand-formation';
import {indoorZones,renderWindowWeather} from './window-weather';
import {furnishings,seatDefinition,actorHeights} from './layouts';
import Phaser from 'phaser';
import {birthdayConfig as config,type Gift} from '../content/birthday-config';
import {save,persist,grantItem,isCollected} from './state';
import {Signals} from './signals';
import {assetUrl,textureFiles,additionalTextureFiles,coreTextureKeys} from './assets';
import {findPath,advanceAlong,moveWithCollision,nearestWalkable,type Point} from './navigation';
import {WorldMotion} from './world-motion';
import {ActorController,actions} from './actors';
import {FootstepFollower} from './follow';
import {worlds,entrySpawn,inReach,type Zone,type Item} from './world';
export type {Zone,Item} from './world';
export class Cottage extends Phaser.Scene {
 readonly bridge=new Signals();
 private cloudMotion?:CloudMotion;
 private pendingLayers=new Map<string,Map<string,string>>();
 private onlinePets?:OnlinePets;private onlineBoyGear?:{hat:Phaser.GameObjects.Image;ear:Phaser.GameObjects.Image;band:Phaser.GameObjects.Image};private onlineSeat?:{from:Point;to:Point;elapsed:number;standing:boolean};onlineWorld?:OnlineWorld;onlineDirection=0;onlinePose='idle';private onlinePoseUntil=0;get controlledActor(){return this.onlineWorld?.active?this.onlineWorld.local:this.player}
 transitioning=false;private transitionGeneration=0;private transitionTarget:Zone='room';private transitionCleanup?:()=>void;private placeEffects?:PlaceEffects;private windowView?:WindowView;private seatLayers?:SeatLayers;get hasSeatedBody(){return Boolean(this.seated&&this.seatedPhase!==0)}private seatingDuration=.4;private seatedFacing=0;get actorHeight(){return actorHeights[this.zone]??64}private walkingNow=false;private afterStand?:()=>void;private staging=false;private stagingDone?:()=>void;private filmTextures:string[]=[];
 private get bootKeys(){return [...coreTextureKeys,...(save.celebrated?['room-after' as const]:[]),...(save.calendar.enabled?['season-views' as const]:[])]}
 private leaveFerris?:()=>void;
 private updateFerris?: (dt:number)=>void;
 private handFormation=new HandFormation();private motion!:WorldMotion;private pairImage?:Phaser.GameObjects.Image;
 readonly actor=new ActorController();private buddy=new ActorController();private sceneCache:string[]=[];private actionTime=0;private actionKind='';private pairReady=false;private seatedPhase=0;private seatTargets?:number[];
 private autoGames=new Set<string>();
 calendarPaused=false;calendarState:CalendarSnapshot=calendarSnapshot(save.calendar,save.sky);private calendarSignature='';private calendarSaveElapsed=0;weather='clear'; daylight='night'; holding=false;
 blocked=true;entered=false;zone:Zone='room';nearby:Item|undefined;joystick={x:0,y:0};seated='';movingTo:Item|undefined;
 player!:Phaser.GameObjects.Image;boy!:Phaser.GameObjects.Image;hat!:Phaser.GameObjects.Image;band!:Phaser.GameObjects.Image;earwear!:Phaser.GameObjects.Image;
 private companionHat!:Phaser.GameObjects.Image;private outdoorEnvironment?:OutdoorEnvironment;private background!:Phaser.GameObjects.Image;private shadow!:Phaser.GameObjects.Ellipse;private boyShadow!:Phaser.GameObjects.Ellipse;
 private climateGround?:Phaser.GameObjects.Graphics;private trail!:Phaser.GameObjects.Graphics;private glow!:Phaser.GameObjects.Graphics;private effects!:Phaser.GameObjects.Graphics;
 private markers:Phaser.GameObjects.Container[]=[];private giftMarkers=new Map<string,Phaser.GameObjects.Container>();private props=new Map<string,Phaser.GameObjects.Image>();private objects:Item[]=[];
 private keys!:Record<string,Phaser.Input.Keyboard.Key>;private path:Point[]=[];private boyPath:Point[]=[];private pending?:()=>void;private moveTime=0;private idleTime=0;private follower=new FootstepFollower();private dir=0;private lastMotionAt=-1;private starTime=0;private focusId='';private sitReturn?:Point;private boyReturn?:Point;
 private failedAssets=new Set<string>();private readyToEnter=false;
 private cakeDark!:Phaser.GameObjects.Rectangle;private sparkles:Phaser.GameObjects.Rectangle[]=[];
 constructor(){super('cottage')}
 preload(){
  this.failedAssets.clear();this.readyToEnter=false;
  for(const key of this.bootKeys)this.load.image(key,assetUrl(textureFiles[key]));
  for(const gift of config.gifts as Gift[])if(gift.image)this.load.image('cloud-gift-'+gift.id,preparedResource(gift.image));
  this.load.on('progress',(progress:number)=>this.bridge.emit('load-progress',progress));
  this.load.on('loaderror',(file:{key:string})=>{if(file.key.startsWith('cloud-gift-'))return;this.failedAssets.add(file.key);this.bridge.emit('asset-error',file.key)});
 }

 private objectAnimations=new Map<string,()=>void>();private objectTickets=new Map<string,symbol>();
 async playObjectAnimation(id:string,key:keyof typeof textureFiles,frameMs=110){
  this.objectAnimations.get(id)?.();const ticket=Symbol(id),zone=this.zone;this.objectTickets.set(id,ticket);
  await this.ensureTexture(key);if(this.objectTickets.get(id)!==ticket||this.zone!==zone)return;
  const names=Array.from({length:16},(_,i)=>key+'-frame-'+i);this.sliceAtlas(key,4,4,names);
  const item=this.getItem(id);if(!item)return;
  const prop=this.add.image(item.x,item.y+8,names[0]).setOrigin(.5,1).setDisplaySize(key==='gift-opening-v1'?68:76,key==='gift-opening-v1'?68:76).setDepth(25);
  await new Promise<void>(resolve=>{let frame=0;const finish=()=>{event.remove();prop.destroy();this.objectAnimations.delete(id);resolve()};const event=this.time.addEvent({delay:save.reduced?10:frameMs,repeat:15,callback:()=>{if(this.zone!==zone){finish();return}frame++;if(frame<16)prop.setTexture(names[frame]);else finish()}});this.objectAnimations.set(id,finish)});
  if(this.objectTickets.get(id)===ticket)this.objectTickets.delete(id);
 }

 private sliceAtlas(source:string,cols:number,rows:number,names:string[]){
  if(!this.textures.exists(source))return;const img=this.textures.get(source).getSourceImage() as HTMLImageElement;
  for(let index=0;index<names.length;index++){if(this.textures.exists(names[index]))continue;
   const row=Math.floor(index/cols),actualCols=source==='boy-actions'&&row===3?5:cols,col=index%cols;const left=Math.round(col*img.width/actualCols),top=Math.round(row*img.height/rows),width=Math.round((col+1)*img.width/actualCols)-left,height=Math.round((row+1)*img.height/rows)-top;
   const cell=document.createElement('canvas');cell.width=width;cell.height=height;const ctx=cell.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.drawImage(img,left,top,width,height,0,0,width,height);
   if(source==='gift-opening-v1'||source==='tea-pour-v1'){this.textures.addCanvas(names[index],cell);continue}
   const picture=ctx.getImageData(0,0,width,height);if(source==='furniture'||source==='sit-transition'){isolateFurniture(picture.data,width,height);ctx.putImageData(picture,0,0)}const pixels=picture.data;let x0=width,y0=height,x1=-1,y1=-1;
   for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(pixels[(y*width+x)*4+3]>64){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}
   const trim=document.createElement('canvas');trim.width=Math.max(1,x1-x0+1);trim.height=Math.max(1,y1-y0+1);const target=trim.getContext('2d')!;target.imageSmoothingEnabled=false;if(x1>=x0)target.drawImage(cell,x0,y0,trim.width,trim.height,0,0,trim.width,trim.height);this.textures.addCanvas(names[index],trim);
  }
 }
 create(){
  this.readyToEnter=false;for(const key of this.bootKeys)if(!this.textures.exists(key))this.failedAssets.add(key);if(this.failedAssets.size){this.bridge.emit('asset-error',[...this.failedAssets]);return}
  this.sliceAtlas('hero',4,4,['girl0','girl1','girl2','girl3','girl-walk-a0','girl-walk-a1','girl-walk-a2','girl-walk-a3','girl-walk-b0','girl-walk-b1','girl-walk-b2','girl-walk-b3','girl-portrait','girl-portrait-left','pink-case','cat-bag']);this.sliceAtlas('gifts',4,3,config.gifts.map(g=>'gift-'+g.id));this.sliceAtlas('props',4,2,Array.from({length:8},(_,i)=>'prop-'+i));
  this.background=this.add.image(0,0,this.backgroundKey).setOrigin(0).setDisplaySize(640,426.667).setDepth(0);this.outdoorEnvironment=new OutdoorEnvironment(this);this.climateGround=this.add.graphics().setDepth(1.1);this.trail=this.add.graphics().setDepth(2);this.glow=this.add.graphics().setDepth(3);this.effects=this.add.graphics().setDepth(8);
  this.shadow=this.add.ellipse(320,356,19,6,0x2d2030,.3).setDepth(5);this.boyShadow=this.add.ellipse(365,343,19,6,0x2d2030,.3).setDepth(5);
  this.player=this.add.image(320,356,'girl0').setOrigin(.5,1).setDisplaySize(23,37).setDepth(10);this.boy=this.add.image(363,338,'__DEFAULT').setOrigin(.5,1).setDisplaySize(24,37).setDepth(9);
  this.cloudMotion=new CloudMotion(this);
  this.buildActionFrames();
  for(const gift of config.gifts as Gift[]){if(!gift.image)continue;const key='cloud-gift-'+gift.id;if(!this.textures.exists(key))continue;const source=this.textures.get(key).getSourceImage() as HTMLImageElement;const canvas=document.createElement('canvas');const scale=Math.min(1,512/Math.max(source.width,source.height));canvas.width=Math.max(1,Math.round(source.width*scale));canvas.height=Math.max(1,Math.round(source.height*scale));canvas.getContext('2d')!.drawImage(source,0,0,canvas.width,canvas.height);this.textures.remove('gift-'+gift.id);this.textures.addCanvas('gift-'+gift.id,canvas)}
  this.boy.setTexture(this.textures.exists('boy-pose-0')?'boy-pose-0':'__DEFAULT');
  this.hat=this.add.image(0,0,'wear-hat').setDisplaySize(28,20).setDepth(12);this.band=this.add.image(0,0,'wear-band').setDepth(12);
  this.companionHat=this.add.image(0,0,'rack-navy').setVisible(false);
  this.earwear=this.add.image(0,0,'gift-earphones').setDisplaySize(16,16).setDepth(13);
  this.cakeDark=this.add.rectangle(320,213.333,640,426.667,0x0b1022,.5).setDepth(20).setVisible(false);
  this.keys=this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E') as Record<string,Phaser.Input.Keyboard.Key>;this.input.keyboard!.on('keydown-E',()=>{if(!this.blocked&&!this.seated)this.interactNearest()});
  this.onlinePets=new OnlinePets(this);this.windowView=new WindowView(this);this.seatLayers=new SeatLayers(this);this.motion=new WorldMotion(this);this.placeEffects=new PlaceEffects(this);this.rebuild();this.resizeView();this.syncFollowing();this.readyToEnter=true;this.bridge.emit('cottage-ready');
 }
 setFollowing(enabled:boolean){if(!enabled){this.holding=false;this.handFormation.reset()}save.following=enabled;persist();this.syncFollowing();this.bridge.emit('following',enabled)}
 syncFollowing(){if(this.player&&this.boy)this.follower.setEnabled(save.following,this.player,this.boy,this.walkable)}
 private queuedAction='';
 approachForAction(kind:string){if(this.onlineWorld?.active){if(kind==='hand'||kind==='hug'){if(!this.onlineWorld.requestAffection(kind))this.bridge.emit('unreachable');return}this.onlinePose=kind;this.onlinePoseUntil=this.idleTime+2.5;return;}if(this.blocked)return;if(this.seated){this.whenStanding(()=>this.approachForAction(kind));return;}this.queuedAction=kind;const target=this.getItem('boy');if(!target)return;this.stop();this.queuedAction=kind;if(inReach(this.player,target,this.walkable)){this.queuedAction='';this.affection(kind)}else this.walk({x:target.point[0],y:target.point[1]},()=>{const next=this.queuedAction;this.queuedAction='';if(next)this.affection(next)})}
 poseSource(who:'girl'|'boy',frame:number){const key=this.appearanceKey(who,who+'-pose-'+frame);return this.textures.exists(key)?this.textures.get(key).getSourceImage() as HTMLCanvasElement:undefined}
 walkingSource(who:'girl'|'boy',dir:number,phase:number){const key=this.appearanceKey(who,who+'-stride-'+(dir*4+phase));return this.textures.exists(key)?this.textures.get(key).getSourceImage() as HTMLCanvasElement:undefined}
 coupleSource(index:number,holding=false){const base=(holding?'holding-art-':'pair-art-')+index;if(!this.textures.exists(base))return undefined;return this.textures.get(this.pairTexture(index,holding)).getSourceImage() as HTMLCanvasElement}
 avatar(who:'girl'|'boy'){
  const network=this.onlineWorld?.active?this.onlineWorld:undefined;
  const local=network?network.role===(who==='girl'?'host':'guest'):who==='girl';
  const remote=network&&!local?network.remote:undefined;
  const previous=save.appearance[who];
  let source:HTMLCanvasElement|undefined;
  try{
   if(remote)save.appearance[who]={hair:remote.appearance.hair??0,color:remote.appearance.color??0,skin:remote.appearance.skin??0,outfit:remote.appearance.outfit??0};
   source=this.poseSource(who,0);
  }finally{save.appearance[who]=previous}
  if(!source)return '';
  const gear=local?this.networkEquipment():remote?.equipment??(!network&&who==='boy'&&save.companionHat?{hat:true,band:false,earphones:false}:undefined);
  if(!gear||!gear.hat&&!gear.earphones&&!gear.band)return source.toDataURL();
  const canvas=document.createElement('canvas');
  const headWidth=source.width*.86,pad=Math.ceil(headWidth*.45);
  canvas.width=source.width+2*pad;canvas.height=source.height+pad;
  const context=canvas.getContext('2d')!;
  context.imageSmoothingEnabled=false;
  context.drawImage(source,pad,pad);
  const head={x:canvas.width/2,top:pad,width:headWidth,height:source.height*.48,facing:0};
  if(gear.hat)drawHat(context,this.textures.get(!network&&who==='boy'?'rack-navy':'wear-hat').getSourceImage() as HTMLCanvasElement,head);
  if(gear.earphones)drawEarphones(context,this.textures.get('gift-earphones').getSourceImage() as HTMLCanvasElement,head);
  if(gear.band){const size=Math.max(3,source.width*.14);context.drawImage(this.textures.get('wear-band').getSourceImage() as HTMLCanvasElement,pad+source.width*.77,pad+source.height*.68,size,size*.6)}
  return canvas.toDataURL();
 }
 refreshAppearance(){for(const who of ['girl','boy'] as const){const prefix=who+'-styled-';for(const key of this.textures.getTextureKeys())if(key.startsWith(prefix)||((key.startsWith('pair-art-')||key.startsWith('holding-art-'))&&key.includes('{')))this.textures.remove(key)}this.setPose(this.player,'girl',this.seated?'sit':'idle',0);this.setPose(this.boy,'boy',this.seated?'sit':'idle',0)}
 private appearanceKey(who:'girl'|'boy',base:string){if(!this.textures.exists(base))return base;const a=save.appearance[who],key=who+'-styled-'+base+'-'+[a.hair,a.color,a.skin,a.outfit].join('-');if(this.textures.exists(key))return key;const source=this.textures.get(base).getSourceImage() as HTMLCanvasElement,c=document.createElement('canvas');c.width=source.width;c.height=source.height;const g=c.getContext('2d')!;g.imageSmoothingEnabled=false;g.drawImage(source,0,0);if(a.hair>0&&!base.startsWith('pair-')&&!base.startsWith('holding-')&&!base.startsWith('head-')){const index=Number(base.split('-').at(-1)),dir=base.includes('-soak-')||base.includes('-sitmove-')?0:base.includes('-stride-')?Math.floor(index/4):index<4?index:index<8?index-4:0;const headKey=who+'-head-'+(a.hair*4+dir);if(this.textures.exists(headKey)){const head=this.textures.get(headKey).getSourceImage() as HTMLCanvasElement;const h=c.height*(who==='girl'?.59:.51),w=h*head.width/head.height;const before=g.getImageData(0,0,c.width,Math.min(c.height,Math.ceil(h))),hands=captureRaisedHands(before.data,before.width,before.height,before.height);g.clearRect(0,0,c.width,h);g.drawImage(head,(c.width-w)/2,0,w,h);const composed=g.getImageData(0,0,c.width,before.height);restoreRaisedHands(composed.data,hands);g.putImageData(composed,0,0)}}const image=g.getImageData(0,0,c.width,c.height);recolorAppearance(image.data,c.width,c.height,who,a,base);g.putImageData(image,0,0);this.textures.addCanvas(key,c);return key}
 private async ensureTexture(key:keyof typeof textureFiles|keyof typeof additionalTextureFiles){if(this.textures.exists(key))return;await new Promise<void>((resolve,reject)=>{const image=new Image();image.onload=()=>{if(!this.textures.exists(key))this.textures.addImage(key,image);resolve()};image.onerror=reject;image.src=assetUrl(({...textureFiles,...additionalTextureFiles})[key])})}
 async prepareInteractionArt(){await this.ensureTexture('interaction-props');this.sliceAtlas('interaction-props',4,4,effectFrames)}
 async prepareCalendar(){await this.ensureTexture('season-views')}
 refreshEnvironment(){this.calendarState=calendarSnapshot(save.calendar,save.sky);this.weather=this.calendarState.weather;this.daylight=this.calendarState.period;this.bridge.emit('calendar',this.calendarState)}
 private calendarClock?:number;
 resetCalendarClock(){this.calendarClock=undefined}
 private updateCalendar(delta:number){
  const now=typeof performance==='undefined'?undefined:performance.now();
  const elapsed=now===undefined?Math.max(0,delta)/1000:this.calendarClock===undefined?0:Math.max(0,now-this.calendarClock)/1000;
  this.calendarClock=now;
  const oldDate=save.calendar.date;
  if(this.entered&&!this.calendarPaused&&advanceCalendar(save.calendar,elapsed)){
   this.calendarSaveElapsed+=elapsed;
   if(this.calendarSaveElapsed>=30||save.calendar.date!==oldDate){this.calendarSaveElapsed=0;persist()}
  }
 const c=save.calendar,key=[c.enabled,c.date,Math.floor(c.minutes*4),c.timeMode,c.timeScale,c.seasonMode,c.season,c.weatherMode,c.weather,c.temperatureMode,c.temperature,save.sky.time,save.sky.weather].join(':');if(key!==this.calendarSignature){this.calendarSignature=key;this.refreshEnvironment()}}
 async prepareBirthday(){await Promise.all([this.ensureTexture('cake'),this.ensureTexture('pier'),this.ensureTexture('room-after')])}
 private filmUsers=0;
 private filmPreparation?:Promise<void>;
 prepareCinema(){
  this.filmUsers++;
  return this.filmPreparation??=(async()=>{
   for(const key of ['garden','forest','pier'] as const){
    if(this.textures.exists(key))continue;
    await this.ensureTexture(key);
    this.filmTextures.push(key);
   }
  })();
 }
 releaseCinema(){
  if(this.filmUsers===0||--this.filmUsers>0)return;
  for(const key of this.filmTextures){
   if(key!==this.backgroundKey&&!this.sceneCache.includes(key))this.textures.remove(key);
  }
  this.filmTextures=[];
  this.filmPreparation=undefined;
 }
 private async ensureZone(zone:Zone,generation=this.transitionGeneration){if(zone==='catcottage'){await this.ensureTexture('pet-cat');this.sliceAtlas('pet-cat',6,1,Array.from({length:6},(_,i)=>'cottage-cat-'+i))}if(zone==='memory'||zone==='cinema'){await this.ensureTexture('seats-back');this.sliceAtlas('seats-back',2,2,['seat-rocking-back','seat-cinema-back','seat-memory-back','seat-cream-front'])}if(zone==='hotspring'){await this.ensureTexture('footbath-poses');this.sliceAtlas('footbath-poses',3,2,[...Array.from({length:3},(_,i)=>'girl-soak-'+i),...Array.from({length:3},(_,i)=>'boy-soak-'+i)])}if(furnishings[zone]){await this.ensureTexture('furniture');this.sliceAtlas('furniture',4,4,Array.from({length:16},(_,i)=>'furnishing-'+i))}if(zone==='ferris')await this.ensureTexture('ferris-platform');if(['magic','haunted','ferris'].includes(zone)){await this.ensureTexture('wheel-actors');this.sliceAtlas('wheel-actors',2,2,['motion-wheel','motion-cabin','motion-ghost','motion-book'])}const key=worlds[zone].texture;if(!this.textures.exists(key)){const file=textureFiles[key as keyof typeof textureFiles],remote=worlds[zone].backgroundUrl;if(remote){this.bridge.emit('cloud-scene-load',zone,null);
 try{await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
 const image=await loadCloudBackground(remote,ratio=>{if(generation===this.transitionGeneration)this.bridge.emit('cloud-scene-load',zone,ratio)});if(!this.textures.exists(key))this.textures.addImage(key,image)}finally{if(generation===this.transitionGeneration)this.bridge.emit('cloud-scene-load',undefined)}}else if(file)await new Promise<void>((resolve,reject)=>{const image=new Image();const timer=setTimeout(()=>{image.onload=null;image.onerror=null;image.src='';reject(Error(key))},8000);image.onload=()=>{clearTimeout(timer);if(!this.textures.exists(key))this.textures.addImage(key,image);resolve()};image.onerror=()=>{clearTimeout(timer);reject(Error(key))};image.src=assetUrl(file)});else throw Error(key)}if(worlds[zone].layers?.length&&this.cloudMotion){
 const keys=await this.cloudMotion.prepare(worlds[zone].layers!);
 if(generation!==this.transitionGeneration)this.cloudMotion.discard(keys);
 else {const prior=this.pendingLayers.get(zone);if(prior)this.cloudMotion.discard(prior);this.pendingLayers.set(zone,keys)}
}if(generation!==this.transitionGeneration){if(key!==worlds[this.zone].texture&&key!==worlds[this.transitionTarget].texture&&!coreTextureKeys.includes(key as any))this.textures.remove(key);return}this.sceneCache=this.sceneCache.filter(k=>k!==key);this.sceneCache.push(key);while(this.sceneCache.length>3){const old=this.sceneCache.shift()!;if(!coreTextureKeys.includes(old as any))this.textures.remove(old)}for(const exit of worlds[zone].items.filter(i=>i.to).slice(0,2)){const next=worlds[exit.to!].texture;if(!worlds[exit.to!].backgroundUrl&&!this.textures.exists(next)){const image=new Image();image.src=assetUrl(textureFiles[next as keyof typeof textureFiles])}}}
 private renderMoving(actor:Phaser.GameObjects.Image,who:'girl'|'boy',dir:number,moving:boolean,phase:number){
  const index=dir*4+phase;
  const base=who+'-stride-'+index;
  if(!moving||!this.textures.exists(base)){this.setPose(actor,who,'idle',dir);return}
  const integrated='girl-hat-band-stride-'+index;
  const useIntegrated=who==='girl'&&!this.onlineWorld?.active&&!this.leaveFerris
   &&save.hat&&save.band&&!save.earphones
   &&Object.values(save.appearance.girl).every(value=>value===0)
   &&this.textures.exists(integrated);
  actor.setTexture(useIntegrated?integrated:this.appearanceKey(who,base));
  // Both atlases share the source resolution. Use the base reference so the
  // taller cap doesn't change the character's scale when equipment changes.
  const reference=this.textures.get(who+'-stride-0').getSourceImage() as HTMLCanvasElement;
  actor.setScale(this.actorHeight/reference.height);
 }
 private get integratedWalkGear(){
  const key=this.player?.texture?.key;
  return typeof key==='string'&&key.startsWith('girl-hat-band-stride-');
 }
 private isWornGift(id:string){return (id==='hat'||id==='band'||id==='earphones')&&save[id]}
 private buildActionFrames(){this.sliceAtlas('girl-walk-hat-band',4,4,Array.from({length:16},(_,index)=>'girl-hat-band-stride-'+index));this.sliceAtlas('wearables',2,1,['wear-hat','wear-band']);this.sliceAtlas('pet-cat',6,1,Array.from({length:6},(_,i)=>'cottage-cat-'+i));this.sliceAtlas('weather-icons',3,2,['weather-clear','weather-rain','weather-snow','time-dawn','time-day','time-night']);this.sliceAtlas('holding-walk',4,4,Array.from({length:16},(_,i)=>'holding-art-'+i));this.sliceAtlas('holding-walk-allgear',4,4,Array.from({length:16},(_,i)=>'holding-allgear-'+i));this.sliceAtlas('furniture',4,4,Array.from({length:16},(_,i)=>'furnishing-'+i));this.sliceAtlas('couple-actions',4,3,Array.from({length:12},(_,i)=>'pair-art-'+i));this.pairImage=this.add.image(0,0,'pair-art-0').setOrigin(.5,1).setDepth(15).setVisible(false);for(const who of ['girl','boy']){this.sliceAtlas(who+'-heads',4,4,Array.from({length:16},(_,i)=>who+'-head-'+i));for(let i=0;i<16;i++)this.textures.addCanvas('head-'+who+'-head-'+i,this.textures.get(who+'-head-'+i).getSourceImage() as HTMLCanvasElement)}this.sliceAtlas('world-actors',4,4,[...Array.from({length:4},(_,i)=>'train-'+i),...Array.from({length:4},(_,i)=>'jelly-'+i),...Array.from({length:4},(_,i)=>'fish-'+i),...Array.from({length:4},(_,i)=>'flame-'+i)]);this.sliceAtlas('wheel-actors',2,2,['motion-wheel','motion-cabin','motion-ghost','motion-book']);for(const who of ['girl','boy'])if(this.textures.exists(who+'-walk'))this.sliceAtlas(who+'-walk',4,4,Array.from({length:16},(_,i)=>who+'-stride-'+i));for(const who of ['girl','boy'])this.sliceAtlas(who+'-actions',4,4,Array.from({length:16},(_,i)=>who+'-pose-'+i));this.sliceAtlas('icons-v2',4,4,['ui-music','ui-journal','ui-photo','ui-fullscreen','ui-settings','ui-map','ui-companion','ui-sky','ui-bag','ui-flower','ui-portrait','ui-letter','ui-sign','ui-door','ui-home','ui-wand']);this.sliceAtlas('gifts-v2',2,2,['red-doll','red-earphones','pink-band','white-hat']);for(const [id,key]of [['doll','red-doll'],['earphones','red-earphones'],['band','pink-band'],['hat','white-hat']]){this.textures.remove('gift-'+id);const source=this.textures.get(key).getSourceImage() as HTMLCanvasElement;this.textures.addCanvas('gift-'+id,source)}}
 private setPose(actor:Phaser.GameObjects.Image,who:'girl'|'boy',pose:string,dir:number){const index=pose==='sit'?4+dir:pose==='action'?dir:dir;const key=pose==='sit'&&this.seated==='hotspring-seat'?who+'-soak-'+(save.reduced?0:Math.floor(this.idleTime*2)%3):who+'-pose-'+index;if(this.textures.exists(key)){actor.setTexture(this.appearanceKey(who,key));const src=actor.texture.getSourceImage() as HTMLCanvasElement;const ref=this.textures.get(who+'-pose-0').getSourceImage() as HTMLCanvasElement;const scale=this.actorHeight/ref.height;actor.setDisplaySize(src.width*scale,src.height*scale)}}
 get backgroundKey(){return this.zone==='room'&&save.celebrated?'room-after':worlds[this.zone].texture}
 drawEnvironment(context:CanvasRenderingContext2D,x:number,y:number,width:number,height:number){
  context.drawImage(this.textures.get(this.backgroundKey).getSourceImage() as HTMLImageElement,x,y,width,height);
  this.outdoorEnvironment?.drawTo(context,x,y,width,height);
  if(this.zone==='room'&&this.textures.exists('window-live'))context.drawImage(this.textures.get('window-live').getSourceImage() as HTMLCanvasElement,x,y,width,height);
 }
 get walkable(){return worlds[this.zone].walkable}
 getItem(id:string){return this.objects.find(item=>item.id===id)}
 tapWorld(x:number,y:number,worldPerPixel=1/Math.max(.01,this.cameras?.main?.zoom??1),coarse=false){
  if(this.blocked||!this.entered||this.onlineWorld?.contactLocksMovement)return;
  if(this.seated){this.whenStanding(()=>this.tapWorld(x,y,worldPerPixel,coarse));return;}
  const candidates=interactionTargets(this.objects.filter(item=>!this.onlineWorld?.active||item.id!=='boy'),{x,y},worldPerPixel,coarse);
  if(candidates.length>1){this.stop();this.bridge.emit('interaction-choices',candidates);return}
  if(candidates[0])this.approach(candidates[0]);else{this.focusId='';this.walk({x,y});this.bridge.emit('destination',{x,y})}
 }
 approachById(id:string){
  const item=this.getItem(id);
  if(item){this.approach(item);return}
  // The map explicitly lists collected gifts, even when they're being worn.
  const worn=this.zone==='room'&&this.isWornGift(id);
  if(worn&&!this.blocked)this.bridge.emit('interact',id);
 }
 resizeView(){if(!this.cameras?.main)return;const camera=this.cameras.main;camera.setZoom((this.zone==='musicroom'||this.zone==='ferris'?Math.min:Math.max)(camera.width/640,camera.height/426.667));this.frameView()}
 private projectionFraming=false;
 frameProjection(enabled:boolean){this.projectionFraming=enabled;this.frameView()}
 private frameView(){const c=this.cameras.main,halfH=c.height/c.zoom/2,halfW=c.width/c.zoom/2;const y=this.zone==='musicroom'||this.zone==='ferris'?213.333:this.projectionFraming?halfH:this.entered?Phaser.Math.Clamp(this.controlledActor.y-80,halfH,426.667-halfH):213.333;c.centerOn(this.entered&&!this.projectionFraming&&this.zone!=='musicroom'&&this.zone!=='ferris'?Phaser.Math.Clamp(this.controlledActor.x,halfW,640-halfW):320,y)}
 private publishedDirections?:boolean;
 private emitPortalPositions(){
  const visible=save.settings.directions;
  if(!visible&&this.publishedDirections===false)return;
  this.publishedDirections=visible;
  const points=[];
  if(visible)for(const item of this.objects){
   if(item.to||item.id==='taoyuan-portal'){
    points.push({id:item.id,name:item.to?worlds[item.to].name:item.name,...this.project(item.x,item.y)});
   }
  }
  this.bridge.emit('portal-positions',points);
 }
 project(x:number,y:number){const c=this.cameras.main;return{x:(x-c.worldView.x)*c.zoom,y:(y-c.worldView.y)*c.zoom}}
 async transitionTo(zone:Zone,done:()=>void){
  if(!this.onlineWorld?.handWalking)this.onlineWorld?.cancelAffection();const generation=++this.transitionGeneration;this.transitionTarget=zone;this.transitioning=true;this.transitionCleanup?.();this.transitionCleanup=undefined;this.blocked=true;this.stop();this.bridge.emit('scene-cover',zone);
  try{await this.ensureZone(zone,generation)}catch{if(generation===this.transitionGeneration){this.transitioning=false;this.blocked=false;this.cameras.main.fadeIn(200,19,17,28);this.bridge.emit('scene-cover',undefined);this.bridge.emit('zone-error')}return}
  if(generation!==this.transitionGeneration)return;
  this.blocked=true;this.stop();this.clearHint();const camera=this.cameras.main,duration=save.reduced?1:300;
  let switched=false;
  let fadeInFallback:ReturnType<typeof setTimeout>|undefined;
  const arrived=()=>{if(generation!==this.transitionGeneration||!this.transitioning)return;this.transitionCleanup?.();this.transitionCleanup=undefined;this.transitioning=false;this.blocked=false;this.bridge.emit('scene-cover',undefined);done()};
  const covered=()=>{if(generation!==this.transitionGeneration||switched)return;switched=true;this.changeZone(zone);this.resizeView();camera.once('camerafadeincomplete',arrived);fadeInFallback=setTimeout(arrived,duration+500);camera.fadeIn(duration,19,17,28)};
  const fadeOutFallback=setTimeout(covered,duration+500);
  this.transitionCleanup=()=>{clearTimeout(fadeOutFallback);clearTimeout(fadeInFallback);camera.off('camerafadeoutcomplete',covered);camera.off('camerafadeincomplete',arrived)};
  camera.once('camerafadeoutcomplete',covered);camera.fadeOut(duration,19,17,28);
 }

 private rebuild(){
  const layers=this.pendingLayers.get(this.zone);
  if(layers){this.cloudMotion?.mount(worlds[this.zone].layers??[],layers);this.pendingLayers.delete(this.zone)}else if(!worlds[this.zone].layers?.length)this.cloudMotion?.clear();
  this.motion?.rebuild();this.markers.forEach(m=>m.destroy());this.markers=[];this.giftMarkers.clear();this.props.clear();this.trail.clear();for(const prop of furnishings[this.zone]??[]){const icon=this.add.image(0,0,prop.texture??'furnishing-'+prop.frame).setOrigin(.5,1).setDisplaySize(prop.w,prop.h);this.markers.push(this.add.container(prop.x,prop.y,[icon]).setDepth(prop.floor?1:10+prop.y/1000));this.props.set(prop.id,icon)}
  if(this.zone==='room'){
   const patch=this.add.image(0,0,'rack-background').setOrigin(0).setDisplaySize(76/2.4,126/2.4);
   this.markers.push(this.add.container(111/2.4,768/2.4,[patch]).setDepth(.1));
  }
  const gifts=this.zone==='room'?config.gifts.filter(g=>!this.isWornGift(g.id)).map(g=>({...g})):[];
  const visibleItems=worlds[this.zone].items.filter(item=>!isCollected(item));
  this.objects=[...gifts,...visibleItems.map(item=>({...item})),{id:'boy',name:config.boyName==='我'?'等你的那个人':config.boyName,action:'说说话',x:this.boy.x,y:this.boy.y-14,point:[this.boy.x-27,this.boy.y]}];
  for(const g of gifts){const opened=save.opened.includes(g.id);const icon=this.add.image(0,0,g.id==='hat'&&!this.textures.exists('cloud-gift-hat')?'rack-ivory':(opened||('image' in g&&g.image&&this.textures.exists('cloud-gift-'+g.id)))?'gift-'+g.id:(g.id==='mystery'?'gift-mystery':'gift-labubu')).setDisplaySize(g.id==='hat'?17:g.id==='moon'&&opened?22:16,g.id==='hat'?15:17);const group=this.add.container(g.x,g.y,[icon]).setDepth(4);this.markers.push(group);this.giftMarkers.set(g.id,group);if(opened){this.trail.fillStyle(0xe9c5b3,.85);this.trail.fillRect(g.point[0]+8,g.point[1]+2,6,3);this.trail.fillStyle(0xbd6683);this.trail.fillRect(g.point[0]+10,g.point[1]+1,2,5)}}
 for(const item of visibleItems){
   if(item.id==='rack-companion-hat'&&(!save.companionHat||this.onlineWorld?.active)){
    const icon=this.add.image(0,0,'rack-navy').setDisplaySize(17,15);
    this.markers.push(this.add.container(item.x,item.y,[icon]).setDepth(4));
   }
   if(item.prop!==undefined||item.texture){const icon=this.add.image(0,0,item.texture??'prop-'+item.prop).setOrigin(.5,1).setDisplaySize(item.prop===7?20:25,item.prop===7?27:26);const group=this.add.container(item.x,item.y+5,[icon]).setDepth(4);this.markers.push(group);this.props.set(item.id,icon)}
   const placed=save.placements[this.zone+':'+item.id];if(placed&&!this.isWornGift(placed)){const texture=this.textures.exists('gift-'+placed)?'gift-'+placed:placed==='shell'?'prop-5':placed==='lantern'?'prop-0':'gift-notes';const icon=this.add.image(0,0,texture).setOrigin(.5,1).setDisplaySize(20,22);this.markers.push(this.add.container(item.x,item.y,[icon]).setDepth(7))}else if(item.kind==='collect'&&!save.inventory.includes(item.collect??'')){const icon=this.add.image(0,0,item.collect==='flower'?'ui-flower':item.collect==='shell'?'prop-5':'ui-letter').setDisplaySize(18,18);this.markers.push(this.add.container(item.x,item.y,[icon]).setDepth(7))}
   if(item.to){const icon=this.add.image(0,0,'ui-sign').setDisplaySize(24,24);this.markers.push(this.add.container(item.x,item.y-8,[icon]).setDepth(6))}
  }
  const showAccessories=!this.pairImage?.visible;const showLayeredGear=showAccessories&&!this.integratedWalkGear;this.hat.setVisible(showLayeredGear&&save.hat);this.band.setVisible(showLayeredGear&&save.band);this.earwear?.setVisible(showAccessories&&save.earphones);this.clearHint();this.seatLayers?.rebuild();
 }
 refresh(){this.background.setTexture(this.backgroundKey);this.rebuild()}
 async reloadCloudWorld(install:()=>void,rollback:()=>void){
  const previous=this.zone,position={x:this.player.x,y:this.player.y,bx:this.boy.x,by:this.boy.y};
  this.transitioning=true;this.blocked=true;this.stop();this.bridge.emit('scene-cover',previous);
  try{
   install();
   const target=Object.hasOwn(worlds,previous)?previous:'room';
   await this.ensureZone(target);
   this.changeZone(target);
   if(target===previous){
    const p=nearestWalkable(position,this.walkable,180),b=nearestWalkable({x:position.bx,y:position.by},this.walkable,180);
    if(p)this.player.setPosition(p.x,p.y);
    if(b)this.boy.setPosition(b.x,b.y);
   }
   this.resizeView();this.syncFollowing();this.savePosition();
   return true;
  }catch{
   rollback();this.zone=previous;this.background.setTexture(this.backgroundKey).setDisplaySize(640,426.667);this.rebuild();
   return false;
  }finally{
   this.transitioning=false;this.blocked=false;this.bridge.emit('scene-cover',undefined);
  }
 }
 savePosition(){if(!this.entered||this.transitioning||this.leaveFerris||this.onlineWorld?.active)return;const p=nearestWalkable(this.player,this.walkable,180),b=nearestWalkable(this.boy,this.walkable,180);if(p&&b)save.resume={zone:this.zone,x:p.x,y:p.y,boyX:b.x,boyY:b.y}}
 private restorePosition(){const pos=save.resume;if(!pos||pos.zone!==this.zone)return;const p=nearestWalkable({x:pos.x,y:pos.y},this.walkable,120),b=nearestWalkable({x:pos.boyX,y:pos.boyY},this.walkable,120);if(p)this.player.setPosition(p.x,p.y);if(b)this.boy.setPosition(b.x,b.y);this.syncFollowing();this.frameView()}
 async enter(){if(!this.readyToEnter||this.entered)return;this.entered=true;this.blocked=false;this.player.setTexture('girl2');this.dir=2;const resume=save.resume;if(resume&&Object.hasOwn(worlds,resume.zone)){this.transitioning=true;this.blocked=true;try{await this.ensureZone(resume.zone as Zone);this.changeZone(resume.zone as Zone);this.restorePosition()}catch{this.bridge.emit('zone-error')}finally{this.transitioning=false;this.blocked=false}}this.cameras.main.fadeIn(save.reduced?1:850,25,19,27)}
 walk(point:Point,callback?:()=>void){this.onlineWorld?.cancelFollowing();if(this.actionKind)this.stop();if(this.movingTo){this.movingTo=undefined;this.bridge.emit('approaching',undefined)}this.path=findPath(this.controlledActor,point,this.walkable);this.pending=this.path.length?callback:undefined;this.actor.move(this.controlledActor,point,this.walkable,()=>{this.movingTo=undefined;this.bridge.emit('approaching',undefined);const next=this.pending;this.pending=undefined;next?.()});if(!this.path.length)this.bridge.emit('unreachable')}
 approach(item:Item,onArrival?:()=>void){
  if(this.blocked)return;if(this.seated){this.whenStanding(()=>this.approach(item,onArrival));return;}this.focusId=item.id;
  const arrive=()=>{if(this.blocked||!inReach(this.controlledActor,item,this.walkable))return;this.face(item);if(onArrival)onArrival();else this.trigger(item)};
  if(inReach(this.controlledActor,item,this.walkable)){this.stop();arrive();return}
  this.walk({x:item.point[0],y:item.point[1]},arrive);this.movingTo=this.path.length?item:undefined;this.bridge.emit('approaching',this.movingTo);
 }
 private face(item:Item){const dx=item.x-this.controlledActor.x,dy=item.y-this.controlledActor.y;this.dir=Math.abs(dx)>Math.abs(dy)?(dx<0?1:3):(dy<0?2:0);this.renderMoving(this.controlledActor,this.onlineWorld?.active&&this.onlineWorld.role==='guest'?'boy':'girl',this.dir,false,0)}
 private trigger(item:Item){if(this.blocked||!inReach(this.controlledActor,item,this.walkable))return;this.path=[];this.bridge.emit('interact',item.id)}
 interactNearest(){if(this.nearby)this.approach(this.nearby)}
 clearHint(){this.nearby=undefined;this.bridge.emit('nearby',undefined)}
 rideFerris(onArrival:()=>void){
  if(this.zone!=='ferris'||this.onlineWorld?.active)return;
  const actors=[this.player,this.boy] as const;
  const start=actors.map(actor=>({x:actor.x,y:actor.y}));
  const platform=[{x:309,y:327},{x:331,y:327}];
  const controllers=[this.actor,this.buddy];
  if(platform.some((point,index)=>!this.walkable(point)||!findPath(actors[index],point,this.walkable).length))return;
  const gear=[this.hat,this.band,this.earwear].filter(image=>image.visible);
  const gearOffsets=gear.map(image=>({x:image.x-this.player.x,y:image.y-this.player.y,sx:image.scaleX,sy:image.scaleY}));
  let boarding=0,disembarking=false,finished=false;
  const cabinScale=.34;
  const placeGear=(scale:number,depth:number)=>{
   gear.forEach((image,index)=>{
    const offset=gearOffsets[index];
    image.setPosition(this.player.x+offset.x*scale,this.player.y+offset.y*scale).setScale(offset.sx*scale,offset.sy*scale).setDepth(depth);
   });
  };
  this.glow.clear();
  this.leaveFerris=()=>{
   this.leaveFerris=undefined;this.updateFerris=undefined;
   this.motion.stopRide();
   actors.forEach((actor,index)=>{
    controllers[index].cancel();
    const point=finished?platform[index]:start[index];
    actor.setPosition(point.x,point.y).setDepth(10+point.y/1000);
    this.setPose(actor,index===0?'girl':'boy','idle',0);
   });
   placeGear(1,this.player.depth+.02);
   this.shadow.setVisible(true);this.boyShadow.setVisible(true);this.syncFollowing();
   this.frameView();
  };
  this.shadow.setVisible(false);this.boyShadow.setVisible(false);
  controllers.forEach((controller,index)=>controller.move(actors[index],platform[index],this.walkable));
  const beginTurn=()=>{
   this.updateFerris=undefined;
   this.motion.startRide((x,y,depth)=>{
    actors.forEach((actor,index)=>{
     this.setPose(actor,index===0?'girl':'boy','sit',0);
     actor.setScale(actor.scaleX*cabinScale).setPosition(x+(index===0?-6:6),y+7).setDepth(depth);
    });
    placeGear(cabinScale,depth+.1);
   },()=>{
    disembarking=true;
    this.updateFerris=boardStep;
   });
  };
  const boardStep=(dt:number)=>{
   boarding=Math.max(0,Math.min(1,boarding+dt*(disembarking?-1:1)*1.7));
   const blend=boarding*boarding*(3-2*boarding),scale=1+(cabinScale-1)*blend;
   actors.forEach((actor,index)=>{
    this.setPose(actor,index===0?'girl':'boy',boarding>.65?'sit':'idle',disembarking||boarding>.65?0:2);
    const point=platform[index],seatX=index===0?314:326;
    actor.setScale(actor.scaleX*scale).setPosition(point.x+(seatX-point.x)*blend,point.y-4*blend).setDepth(12);
   });
   placeGear(scale,12.1);
   if(disembarking&&boarding===0){finished=true;onArrival()}
   else if(!disembarking&&boarding===1)beginTurn();
  };
  this.updateFerris=(dt)=>{
   actors.forEach((actor,index)=>{
    const before={x:actor.x,y:actor.y};
    const moving=controllers[index].update(actor,dt,this.walkable);
    const dx=actor.x-before.x,dy=actor.y-before.y;
    this.renderMoving(actor,index===0?'girl':'boy',Math.abs(dx)>Math.abs(dy)?dx<0?1:3:dy>0?0:2,moving,Math.floor(this.idleTime*8)%4);
   });
   placeGear(1,this.player.depth+.02);
   if(controllers.every(controller=>!controller.moving))this.updateFerris=boardStep;
  };
  return ()=>this.leaveFerris?.();
 }
 stop(){this.leaveFerris?.();this.afterStand=undefined;this.handFormation.reset();this.staging=false;this.stagingDone=undefined;const acting=Boolean(this.actionKind);this.pairImage?.setVisible(false);this.player?.setVisible(true).setAngle(0);this.boy?.setVisible(true).setAngle(0);if(acting&&this.player&&this.boy){this.setPose(this.player,'girl','idle',0);this.setPose(this.boy,'boy','idle',0)}this.queuedAction='';this.actor.cancel();this.buddy.cancel();this.actionKind='';this.actionTime=0;this.joystick={x:0,y:0};this.path=[];this.pending=undefined;this.boyPath=[];this.movingTo=undefined;this.bridge.emit('approaching',undefined);Object.values(this.keys||{}).forEach(k=>k.reset())}
 changeZone(zone:Zone){
  for(const cancel of this.objectAnimations.values())cancel();this.objectAnimations.clear();this.objectTickets.clear();
  if(this.seated){this.seated='';this.seatTargets=undefined;this.seatedPhase=0;this.bridge.emit('stood')}const previous=this.zone;this.stop();this.zone=zone;if(!save.visited.includes(zone)){save.visited.push(zone);persist()}this.focusId='';this.background.setTexture(this.backgroundKey).setDisplaySize(640,426.667);
  const spawn=entrySpawn(previous,zone);this.player.setPosition(...spawn);const point={x:spawn[0]+Math.max(22,this.actorHeight*.42),y:spawn[1]-10};const near=findPath(this.player,point,this.walkable).at(-1);this.boy.setPosition(near?.x??worlds[zone].boy[0],near?.y??worlds[zone].boy[1]);
  this.boyPath=[];this.setPose(this.player,'girl','idle',0);this.setPose(this.boy,'boy','idle',0);if(zone==='garden'){save.visitedGarden=true;persist()}this.rebuild();this.resizeView();this.syncFollowing();this.bridge.emit('zone',zone);
 }
 sit(kind:string){if(this.onlineWorld?.active){this.onlineWorld.cancelAffection();const d=seatDefinition(this.zone,kind),legacy=this.legacySeats[kind];if(!d?.hips&&!legacy){this.bridge.emit('unreachable');return}this.onlineWorld.cancelFollowing();const index=this.onlineWorld.role==='guest'?2:0,who=index?'boy':'girl',facing=d?.facing??(['sea','starlight','tide'].includes(kind)?2:0),pose=this.textures.get(kind==='hotspring-seat'?who+'-soak-0':who+'-pose-'+(4+facing)).getSourceImage() as HTMLCanvasElement,ref=this.textures.get(who+'-pose-0').getSourceImage() as HTMLCanvasElement;this.seatedFacing=facing;this.onlineDirection=facing;this.onlineSeat={from:{x:this.controlledActor.x,y:this.controlledActor.y},to:{x:d?.hips?.[index]??legacy[index],y:d?.hips?d.hips[index+1]+pose.height*this.actorHeight/ref.height*(kind==='hotspring-seat'?.38:who==='girl'?.24:.30):legacy[index+1]},elapsed:0,standing:false};this.seated=kind;this.seatedPhase=.001;this.onlinePose='sit:'+kind;this.onlinePoseUntil=Infinity;this.actor.cancel();this.bridge.emit('seated',kind);return;}
  if(this.seated){this.whenStanding(()=>this.sit(kind));return}this.stop();void this.prepareSeatArt();
  const positions=this.legacySeats;
  const definition=seatDefinition(this.zone,kind),hips=definition?.hips;this.seatedFacing=definition?.facing??0;const p=hips?[...hips]:positions[kind];if(hips){for(const [who,index]of [['girl',1],['boy',3]] as const){const pose=this.textures.get(kind==='hotspring-seat'?who+'-soak-0':who+'-pose-'+(4+this.seatedFacing)).getSourceImage() as HTMLCanvasElement,ref=this.textures.get(who+'-pose-0').getSourceImage() as HTMLCanvasElement;p![index]+=pose.height*this.actorHeight/ref.height*(kind==='hotspring-seat'?.38:who==='girl'?.24:.30)}}if(!p){this.bridge.emit('unreachable');return}const floor=this.walkable;const girl=nearestWalkable({x:p[0],y:p[1]+28},floor,110),boy=nearestWalkable({x:p[2],y:p[3]+28},floor,110);if(!girl||!boy)return;
  this.seatingDuration=Math.max(.4,Math.min(1.2,Math.max(Math.hypot(girl.x-p[0],girl.y-p[1]),Math.hypot(boy.x-p[2],boy.y-p[3]))/84));this.seatTargets=p;this.seated=kind;this.seatedPhase=0;this.actor.move(this.player,girl,floor);this.buddy.move(this.boy,boy,floor);this.sitReturn=girl;this.boyReturn=boy;this.clearHint();this.bridge.emit('seated',kind);
 }
 private readonly legacySeats:Record<string,number[]>={'magic-seat':[99,177,126,177],'haunted-seat':[117,172,146,172],'cinema-seat':[80,178,158,178],'ferris-seat':[72,204,141,204],'mars-seat':[54,151,80,151],'memory-seat':[100,191,185,191],'aquarium-seat':[184,185,210,185],'camp-seat':[151,160,177,160],'station-seat':[164,170,190,170],'postal-seat':[155,183,181,183],'chair-left':[253,206,388,206],'chair-right':[388,206,253,206],'greenhouse-seat':[132,140,155,140],sofa:[68,288,101,288],tea:[68,288,101,288],swing:[292,149,324,149],bench:[135,194,163,194],sea:[484,250,508,250],window:[325,145,352,145],picnic:[139,205,167,205],oak:[524,190,551,190],fireflies:[278,304,303,304],'pier-bench':[258,199,285,199],starlight:[403,218,431,218],tide:[363,289,389,289]};
 private seatArtPromise?:Promise<void>;
 private prepareSeatArt(){return this.seatArtPromise??=this.ensureTexture('sit-transition').then(()=>{this.sliceAtlas('sit-transition',6,2,[...Array.from({length:6},(_,i)=>'girl-sitmove-'+i),...Array.from({length:6},(_,i)=>'boy-sitmove-'+i)])}).catch(()=>{this.seatArtPromise=undefined})}
 private transitionSeatPose(actor:Phaser.GameObjects.Image,who:'girl'|'boy',amount:number){const key=who+'-sitmove-'+Math.min(5,Math.floor(Math.max(0,amount)*6));if(!this.textures?.exists(key))return false;actor.setTexture(this.appearanceKey(who,key));const src=actor.texture.getSourceImage() as HTMLCanvasElement,ref=this.textures.get(who+'-sitmove-0').getSourceImage() as HTMLCanvasElement;const scale=this.actorHeight/ref.height;actor.setDisplaySize(src.width*scale,src.height*scale);return true}
 private whenStanding(next:()=>void){if(!this.seated){next();return}this.afterStand=next;if(this.seatedPhase>=0)this.stand()}
 private finishStanding(){const next=this.afterStand;this.afterStand=undefined;next?.()}
 stand(){if(this.onlineWorld?.active){if(this.onlineSeat){this.onlineSeat={from:{x:this.controlledActor.x,y:this.controlledActor.y},to:this.onlineSeat.from,elapsed:0,standing:true};this.onlinePose='idle';this.onlinePoseUntil=0;this.bridge.emit('stood')}return}if(!this.seated)return;if(this.seatedPhase===0){this.actor.cancel();this.buddy.cancel();this.seated='';this.seatTargets=undefined;this.bridge.emit('stood');this.syncFollowing();this.finishStanding();return}const p=this.seatTargets;this.seatedPhase=-.001;this.actionTime=0;this.bridge.emit('stood');if(!p){this.seated='';return}}
 private updateSeated(dt:number){const p=this.seatTargets;if(!p)return;const floor=this.walkable;
  if(this.seatedPhase===0){for(const [controller,actor,who]of [[this.actor,this.player,'girl'],[this.buddy,this.boy,'boy']] as const){const x=actor.x,y=actor.y;controller.update(actor,dt,floor);const dx=actor.x-x,dy=actor.y-y,dir=Math.abs(dx)>Math.abs(dy)?dx<0?1:3:dy<0?2:0;this.renderMoving(actor,who,dir,Math.hypot(dx,dy)>.001,Math.floor(this.idleTime*8)%4)}if(!this.actor.moving&&!this.buddy.moving)this.seatedPhase=.001;return}
  const standing=this.seatedPhase<0;this.seatedPhase+=standing?-dt:dt;const t=Math.min(1,Math.abs(this.seatedPhase)/this.seatingDuration);const ease=t*t*(3-2*t);for(const [actor,base,floorPoint,who]of [[this.player,0,this.sitReturn,'girl'],[this.boy,2,this.boyReturn,'boy']] as const){if(!floorPoint)continue;actor.setPosition(standing?p[base]+(floorPoint.x-p[base])*ease:floorPoint.x+(p[base]-floorPoint.x)*ease,standing?p[base+1]+(floorPoint.y-p[base+1])*ease:floorPoint.y+(p[base+1]-floorPoint.y)*ease);const back=['sea','starlight','tide'].includes(this.seated)||this.seatedFacing===2;const bending=t<1&&!back&&this.seated!=='hotspring-seat'&&!save.reduced&&this.transitionSeatPose(actor,who,standing?1-t:t);if(!bending)this.setPose(actor,who,standing&&t>.65?'idle':'sit',back?2:this.seatedFacing)}
  if(t===1&&standing){this.seated='';this.seatTargets=undefined;this.actor.cancel();this.buddy.cancel();this.syncFollowing();this.finishStanding()}
 }
 remember(id:string){this.cloudMotion?.trigger(id);this.motion?.interact(id);if(id==='window'&&this.onlineWorld?.active){const item=this.getItem('window');if(item)this.walk({x:item.point[0],y:item.point[1]},()=>{this.onlineDirection=2;this.onlinePose='idle'});return;}this.placeEffects?.trigger(id);if(id==='window'){const item=this.getItem('window');if(item){this.stop();this.staging=true;const target=nearestWalkable({x:item.point[0],y:item.point[1]},this.walkable,110);if(target){this.actor.move(this.player,target,this.walkable);const other=nearestWalkable({x:target.x+30,y:target.y},this.walkable,80);if(other)this.buddy.move(this.boy,other,this.walkable)}else this.staging=false}}if(id==='shell')grantItem('shell');if(id==='lanterns'||id==='camp-lights')grantItem('lantern');if(id==='starlight'||id==='telescope')this.starTime=this.idleTime;if(!save.moments.includes(id)){save.moments.push(id);persist()}this.animatePlace(id);if(id==='ghost'||id==='ghost-box')this.affection('scare');if(['popcorn','market-bread','spring-tea','aurora-tea','memory-tea'].includes(id))this.affection('share');if(id==='mars-dance')this.affection('dance');if(id==='spell')this.affection('flower');if(id==='paper-plane')this.releasePlane();if(id==='station-bell'||id==='school-bell'){this.bridge.emit('station-chime')}if(id==='postmark')this.confetti()}
 animatePlace(id:string){const icon=this.props.get(id);if(icon&&!save.reduced)this.tweens.add({targets:icon,angle:id==='chime'?13:0,y:icon.y-3,duration:220,yoyo:true,repeat:2})}
 arrangeCake(callback:()=>void){if(this.zone!=='room')return;this.stop();this.staging=true;this.stagingDone=callback;this.actor.move(this.player,{x:278,y:274},this.walkable);this.buddy.move(this.boy,{x:364,y:274},this.walkable)}
 darken(show:boolean){this.cakeDark.setVisible(show);if(this.zone==='room')this.background.setTexture(show?'room':this.backgroundKey)}
 confetti(){if(save.reduced)return;for(let i=0;i<55;i++){const r=this.add.rectangle(200+Math.random()*240,-10-Math.random()*70,2+Math.random()*2,4,[0xeed39c,0xbc7b92,0x9cae83,0xf5e8c8][i%4]).setDepth(30);this.sparkles.push(r);this.tweens.add({targets:r,y:300+Math.random()*100,x:r.x+Math.random()*70-35,angle:Math.random()*360,alpha:0,duration:2600+Math.random()*2000,onComplete:()=>r.destroy()})}}
 animateGift(id:string){const g=config.gifts.find(x=>x.id===id);if(!g)return;const group=this.giftMarkers.get(id);if(!group||save.reduced)return;this.tweens.add({targets:group,y:group.y-5,angle:id==='keychain'?12:0,duration:150,yoyo:true,repeat:1})}
 capture(callback:(image:HTMLImageElement)=>void){const source=this.sys.game.canvas,canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;canvas.getContext('2d')!.drawImage(source,0,0);const image=new Image();image.onload=()=>callback(image);image.src=canvas.toDataURL('image/png')}
 private advance(actor:Phaser.GameObjects.Image,path:Point[],distance:number){return advanceAlong(actor,path,distance,this.walkable)>.001}

 affection(kind:string){if(this.onlineWorld?.active){this.approachForAction(kind);return}if(this.seated||this.actionKind)return;this.stop();if(kind==='hand'){this.holding=!this.holding;if(this.holding)this.setFollowing(true);return}const target=nearestWalkable({x:this.player.x+this.actorHeight*.28,y:this.player.y},this.walkable,24);if(!target){this.bridge.emit('unreachable');return}this.actionKind=kind;this.actionTime=0;this.pairReady=false;this.actor.state='preparing';this.buddy.move(this.boy,target,this.walkable,()=>{this.pairReady=true;this.actionTime=0});if(!this.buddy.moving){this.pairReady=true}}
 private pairTexture(index:number,holding=false){
  const integrated='holding-allgear-'+index;
  const defaultLooks=Object.values(save.appearance).every(appearance=>Object.values(appearance).every(value=>value===0));
  if(holding&&(!save.companionHat||this.onlineWorld?.active)&&save.hat&&save.band&&save.earphones&&defaultLooks&&this.textures.exists(integrated))return integrated;
  const base=(holding?'holding-art-':'pair-art-')+index,key=base+'-'+JSON.stringify(save.appearance)+'-'+save.hat+'-'+save.earphones+'-'+save.band+'-'+(save.companionHat&&!this.onlineWorld?.active);if(this.textures.exists(key))return key;const source=this.textures.get(base).getSourceImage() as HTMLCanvasElement,c=document.createElement('canvas');c.width=source.width;c.height=source.height;const g=c.getContext('2d')!;g.imageSmoothingEnabled=false;for(const [who,left,right]of [['girl',0,c.width*.53],['boy',c.width*.53,c.width]] as const){g.save();g.beginPath();g.rect(left,0,right-left,c.height);g.clip();g.drawImage(this.textures.get(this.appearanceKey(who,base)).getSourceImage() as HTMLCanvasElement,0,0);g.restore()}for(const who of ['girl','boy'] as const){if(save.appearance[who].hair===0)continue;const pose=index%4,front=holding?Math.floor(index/4):0,key=who+'-head-'+(save.appearance[who].hair*4+front);const head=this.textures.get(this.appearanceKey(who,'head-'+key)).getSourceImage() as HTMLCanvasElement;const x=c.width*(who==='girl'?(!holding&&index<4&&pose>0?.34:.25):.74),h=c.height*(who==='girl'?.52:.49),w=h*head.width/head.height;g.drawImage(head,x-w/2,0,w,h)}const girlHead={x:c.width*(!holding&&index<4&&index%4>0?.34:.25),top:0,width:c.width*.43,height:c.height*.52,facing:holding?Math.floor(index/4):0};if(save.companionHat&&!this.onlineWorld?.active)drawHat(g,this.textures.get('rack-navy').getSourceImage() as HTMLImageElement,{x:c.width*.74,top:0,width:c.width*.4,height:c.height*.49,facing:girlHead.facing});if(save.hat)drawHat(g,this.textures.get('wear-hat').getSourceImage() as HTMLCanvasElement,girlHead);if(save.earphones)drawEarphones(g,this.textures.get('gift-earphones').getSourceImage() as HTMLCanvasElement,girlHead);if(save.band){g.fillStyle='#e7a7c2';g.fillRect(c.width*.42,c.height*.65,Math.max(2,c.width*.025),Math.max(2,c.height*.025))}this.textures.addCanvas(key,c);return key}
 private updateAction(dt:number){
  if(!this.pairReady){this.buddy.update(this.boy,dt,this.walkable);return}
  this.actionTime+=dt;
  const kind=this.actionKind;
  const {duration,contact,recover}=actions[kind]??actions.hug;
  const phase=this.actionTime/duration;
  const settling=Math.max(0,Math.min(1,this.actionTime/contact,(duration-this.actionTime)/(duration-recover)));
  const ease=settling*settling*(3-2*settling);
  const pair=['hug','head','share','flower'].includes(kind)&&phase>.12&&phase<.9&&this.pairImage;
  this.player.setVisible(!pair);
  this.boy.setVisible(!pair);
  this.pairImage?.setVisible(Boolean(pair));
  if(pair){
   const group=kind==='head'?4:kind==='flower'||kind==='share'?8:0;
   const pose=save.reduced?2:Math.min(3,Math.floor(phase*4));
   const offset=kind==='share'?2+Math.min(1,Math.floor(phase*2)):kind==='flower'?Math.min(1,Math.floor(phase*2)):pose;
   const source=this.pairTexture(group+offset);
   const foot=Math.max(this.player.y,this.boy.y);
   pair.setTexture(source).setPosition((this.player.x+this.boy.x)/2,foot).setDepth(10+foot/1000);
   const art=pair.texture.getSourceImage() as HTMLCanvasElement;
   pair.setDisplaySize(this.actorHeight*art.width/art.height,this.actorHeight);
  }else if(kind==='shoulder'){
   this.setPose(this.player,'girl','idle',0);
   this.setPose(this.boy,'boy','idle',0);
   const lean=(this.player.x<=this.boy.x?1:-1)*(save.reduced?1:ease);
   this.player.setAngle(lean*12);
   this.boy.setAngle(-lean*4);
  }else{
   const frame=kind==='dance'?12+(save.reduced?2:Math.floor(this.actionTime*7)%4):
    kind==='scare'?(phase<.16?8:phase<.45?15:phase<.72?9:0):
    8+Math.min(3,Math.floor(phase*4));
   this.setPose(this.player,'girl','action',frame);
   this.setPose(this.boy,'boy','action',frame);
   if(kind==='scare'&&!save.reduced){const recoil=Math.sin(Math.PI*ease)*11;this.player.setAngle(-recoil);this.boy.setAngle(recoil)}
  }
  if(this.actionTime<duration)return;
  this.pairImage?.setVisible(false);
  this.player.setVisible(true).setAngle(0);
  this.boy.setVisible(true).setAngle(0);
  this.actionKind='';
  this.actor.cancel();
  this.setPose(this.player,'girl','idle',0);
  this.setPose(this.boy,'boy','idle',0);
  this.syncFollowing();
 }
 private environment(){
  const g=this.effects,t=save.reduced?0:this.idleTime,c=this.calendarState,indoor=indoorZones.has(this.zone);this.climateGround?.clear();renderWindowWeather(g,this.zone,this.weather,this.daylight,t);
  if(c.enabled){
   g.fillStyle(0xffe6b7,(indoor?.035:.18)*c.daylight);g.fillRect(0,0,640,427);g.fillStyle(0x172a4b,(indoor?.02:.15)*(1-c.daylight));g.fillRect(0,0,640,427);
   if(c.period==='dawn'||c.period==='dusk'){g.fillStyle(0xf1adac,indoor?.025:.10);g.fillRect(0,0,640,427)}
   if(!indoor){
    if(c.season==='winter'&&c.temperature<7&&this.climateGround){const snow=this.climateGround;snow.fillStyle(0xe8f3ed,this.weather==='snow'?.72:.42);for(let i=0;i<64;i++){const x=85+i*73%475,y=222+i*43%172;if(this.walkable({x,y})&&this.walkable({x:x+12,y:y+5})){snow.fillRect(x,y,12,3);snow.fillRect(x+3,y-2,7,7)}}}
    if(c.season==='spring'||c.season==='autumn')for(let i=0;i<12;i++){const x=60+(i*79+t*5)%540,y=70+(i*61+t*9)%330;g.fillStyle(c.season==='spring'?0xefbad1:[0xd49b51,0xb67448,0xe0b46e][i%3],.55);g.fillRect(Math.floor(x),Math.floor(y),3,2)}
    if(c.temperature<=4)for(const actor of [this.player,this.boy]){const phase=(t*.7+actor.x*.01)%1;if(phase<.5){g.fillStyle(0xf1f6ef,(.5-phase)*.32);g.fillEllipse(actor.x+8+phase*9,actor.y-actor.displayHeight*.55-phase*3,4+phase*10,3+phase*5)}}
   }
  }else{
   if(this.daylight==='dawn'||this.daylight==='dusk'){g.fillStyle(0xffc58e,indoor?.035:.16);g.fillRect(0,0,640,427)}if(this.daylight==='day'){g.fillStyle(0xffefb1,indoor?.045:.23);g.fillRect(0,0,640,427)}
  }
  if(this.weather!=='clear'&&!indoor)for(let i=0;i<65;i++){const x=(i*83+t*9)%640,y=(i*47+t*(this.weather==='rain'?120:18))%427;g.fillStyle(this.weather==='rain'?0xb7d7eb:0xfff6dd,.6);g.fillRect(x,y,this.weather==='rain'?1:2,this.weather==='rain'?7:2)}
 }
 private releasePlane(){if(save.reduced)return;const plane=this.add.text(448,181,'➤',{fontFamily:'monospace',fontSize:'18px',color:'#fff2cd'}).setDepth(18).setAngle(-25);this.tweens.add({targets:plane,x:130,y:60,angle:-5,alpha:0,duration:3600,ease:'Sine.easeInOut',onComplete:()=>plane.destroy()})}
 private drawTaoyuanPortal(){if(this.zone!=='room')return;const item=this.getItem('taoyuan-portal');if(!item)return;const g=this.effects,x=item.x,y=item.y,t=save.reduced?0:this.idleTime;g.fillStyle(0x283f3c,.75);g.fillEllipse(x,y,51,14);g.lineStyle(3,0xe6c58b,.95);g.strokeEllipse(x,y-20,36,46);g.lineStyle(1,0x89dbb1,.8);g.strokeEllipse(x,y-20,27,37);for(let i=0;i<9;i++){g.fillStyle(i%2?0xf8e3af:0x8de8b4,.6);g.fillRect(x+Math.sin(t*.7+i*2)*12,y-5-((t*9+i*7)%34),2,2)}}
 private atmosphere(){
  const g=this.effects,t=save.reduced?0:this.idleTime;g.clear();this.drawTaoyuanPortal();
  if(this.zone==='aquarium'){
   const active=save.moments.includes('jellyfish');for(let i=0;i<(active?9:4);i++){const x=110+(i*69)%420+Math.sin(t*.4+i)*14,y=65+(i*31)%80+Math.sin(t*.6+i)*6;g.fillStyle(i%2?0xe9b8eb:0xa8e8e6,.24);g.fillEllipse(x,y,12,8);g.lineStyle(1,0xc3e6f0,.3);g.lineBetween(x-2,y+3,x-3+Math.sin(t+i)*3,y+14)}
  }else if(this.zone==='camp'){
   g.fillStyle(0xffbf70,.13);g.fillEllipse(400,156,85+Math.sin(t*3)*4,44);for(let i=0;i<6;i++){g.fillStyle(0xffd291,.65);g.fillRect(394+(i*7)%17+Math.sin(t+i)*3,156-(t*14+i*8)%36,1,2)}if(save.moments.includes('camp-lights'))for(let i=0;i<8;i++){const x=100+i*60,y=98+Math.sin(i*.5)*14;g.fillStyle(0xffdd88,.14);g.fillCircle(x,y,12);g.fillStyle(0xffebbd,.9);g.fillRect(x-1,y,3,4)}if(save.moments.includes('marshmallow')){g.lineStyle(1,0xffead2,.28);for(const x of [387,412]){const rise=(t*6+x)%18;g.lineBetween(x+Math.sin(t)*2,153-rise,x+1+Math.sin(t)*2,149-rise)}}
  }else if(this.zone==='room'){
   const lit=save.moments.includes('fireplace');g.fillStyle(0xffbc55,lit?.14:.07);g.fillEllipse(79,116,lit?100:70,42);
   if(save.moments.includes('flowers'))for(let i=0;i<4;i++){g.fillStyle(0xe5abc0,.55);g.fillRect(437+Math.sin(t*.4+i)*12,123+(t*3+i*9)%36,2,1)}
   if(save.moments.includes('tea'))for(let i=0;i<3;i++){const y=312-((t*6+i*8)%25);g.fillStyle(0xffeddb,.22);g.fillRect(195+Math.sin(t+i)*3,y,2,4)}
   for(const x of [280,292,304,318,332,346]){g.fillStyle(0xffe1a7,.45+Math.sin(t*5+x)*.2);g.fillEllipse(x,164+Math.sin(t*4+x)*1.5,2.5,5)}for(const x of [188,238,391]){g.fillStyle(0xffc77e,.07+(Math.sin(t*2+x)+1)*.025);g.fillCircle(x,105,25)}
  }else if(this.zone==='magic'){
   for(let i=0;i<16;i++){const x=130+(i*71)%390,y=75+(i*47)%120;g.fillStyle(i%2?0xeab7e7:0xafe6da,.4);g.fillRect(x+Math.sin(t*.8+i)*8,y+Math.cos(t+i)*5,2,2)}if(save.moments.includes('potion')){g.lineStyle(1,0xe7a0cb,.4);for(let i=0;i<3;i++)g.strokeCircle(387+i*4,225-(t*5+i*6)%22,1.5)}if(save.moments.includes('spell'))for(let i=0;i<12;i++){const a=i/12*Math.PI*2+t;g.fillStyle(0xffe8b4,.6);g.fillRect(389+Math.cos(a)*26,230+Math.sin(a)*17,2,2)}
  }else if(this.zone==='haunted'){
   if(save.moments.includes('ghost-lights')){g.fillStyle(0xffd28a,.12);g.fillRect(0,0,640,210)}if(save.moments.includes('portrait')){g.fillStyle(0xffdf9c,.5);g.fillEllipse(201,71+Math.sin(t)*2,4,2)}
  }else if(this.zone==='hotspring'){
   for(let i=0;i<9;i++){const x=270+i*18+Math.sin(t*.7+i)*5,y=270-(t*7+i*9)%60;g.fillStyle(0xffefd6,.08);g.fillEllipse(x,y,12,7)}
   if(save.moments.includes('spring-petals')){g.lineStyle(1,0xffd4bc,.36);for(let i=0;i<3;i++){const r=9+(t*12+i*13)%40;g.strokeEllipse(337,255,r*2,r*.45)}}
   if(save.moments.includes('spring-lantern')){g.fillStyle(0xffbd77,.09);g.fillCircle(343,186,35)}
  }else if(this.zone==='market'){
   for(let i=0;i<9;i++){g.fillStyle(0xffdf9c,.055+(Math.sin(t*1.8+i)+1)*.035);g.fillCircle(92+i*58,50+i%2*12,13)}
   if(save.moments.includes('market-cake'))for(let i=0;i<4;i++){g.fillStyle(0xffeead,.8);g.fillRect(320+i*5,245+Math.sin(t*5+i),2,4)}
   if(save.moments.includes('market-flower'))for(let i=0;i<7;i++){g.fillStyle(0xf3bdcc,.6);g.fillRect(140+Math.sin(t*.7+i)*25,160+(t*7+i*9)%45,2,1)}
  }else if(this.zone==='aurora'){
   for(let i=0;i<4;i++){g.fillStyle(i%2?0x8be8ca:0xc7a5f0,.025+(Math.sin(t*.25+i)+1)*.018);g.fillEllipse(270+i*35+Math.sin(t*.16+i)*12,132,16,55)}
   g.fillStyle(0xffbb70,save.moments.includes('aurora-fire')?.16:.07);g.fillEllipse(91,204,70+Math.sin(t*3)*4,42);
   if(save.moments.includes('aurora-tea'))for(let i=0;i<3;i++){g.fillStyle(0xfff3d9,.22);g.fillRect(320+Math.sin(t+i)*3,255-(t*6+i*8)%20,2,4)}
  }else if(this.zone==='forest'){
   const count=save.moments.includes('fireflies')?35:18;
   for(let i=0;i<count;i++){const x=100+((i*73)%440)+Math.sin(t*.7+i)*9,y=140+((i*47)%218)+Math.cos(t*.8+i)*7;g.fillStyle(0xffe593,.2+(Math.sin(t*1.5+i)+1)*.3);g.fillRect(Math.round(x),Math.round(y),i%5===0?2:1,2)}
   if(save.moments.includes('lanterns'))for(const x of [225,272,318,365,411]){g.fillStyle(0xffcd6c,.12);g.fillEllipse(x,173,38,28);g.fillStyle(0xffdf97,.65);g.fillRect(x-2,166,5,8)}
   if(save.moments.includes('fountain')){const r=12+(t*8)%15;g.lineStyle(1,0xbbdfd9,.4);g.strokeEllipse(320,118,r*2,r*.6)}
  }else{
   for(let i=0;i<12;i++){const x=this.zone==='pier'?30+(i*53)%580:480+(i*17)%150,y=this.zone==='pier'?118+(i*29)%260:170+(i*19)%240;g.fillStyle(0xc2dcf0,.15+(Math.sin(t+i)+1)*.1);g.fillRect(x+Math.sin(t*.7+i)*4,y,8+(i%3)*4,1)}
   if(this.zone==='pier'&&(save.moments.includes('starlight')||save.moments.includes('telescope'))){const phase=(t-this.starTime)%9;if(phase<1.4){g.lineStyle(1,0xffedc4,1-phase/1.4);g.lineBetween(150+phase*110,28+phase*32,166+phase*110,32+phase*32)}}
  }
 }
 prepareOnlineContact(target:Point){if(this.seated)this.whenStanding(()=>this.walk(target));else this.walk(target)}
 renderOnlineContact(a:AffectionState,elapsed:number,direction=0,moving=false){if(!this.pairImage)return;const net=this.onlineWorld!,remote=net.remote,remoteWho=net.role==='host'?'boy':'girl',prior=save.appearance[remoteWho],saved={hat:save.hat,earphones:save.earphones,band:save.band};try{if(remote)save.appearance[remoteWho]={hair:remote.appearance.hair??0,color:remote.appearance.color??0,skin:remote.appearance.skin??0,outfit:remote.appearance.outfit??0};const girlGear=net.role==='host'?saved:remote?.equipment??{hat:false,earphones:false,band:false},boyGear=net.role==='guest'?saved:remote?.equipment??{hat:false,earphones:false,band:false};Object.assign(save,girlGear);const index=a.kind==='hand'?direction*4+(moving?Math.floor(elapsed*8)%4:0):Math.min(3,Math.floor(elapsed/2.4*4)),base=this.pairTexture(index,a.kind==='hand'),key=base+'-online-boy-'+JSON.stringify(boyGear);if(!this.textures.exists(key)){const src=this.textures.get(base).getSourceImage() as HTMLCanvasElement,c=document.createElement('canvas');c.width=src.width;c.height=src.height;const g=c.getContext('2d')!;g.imageSmoothingEnabled=false;g.drawImage(src,0,0);const head={x:c.width*.74,top:0,width:c.width*.40,height:c.height*.49,facing:0};if(boyGear.hat)drawHat(g,this.textures.get('wear-hat').getSourceImage() as HTMLCanvasElement,head);if(boyGear.earphones)drawEarphones(g,this.textures.get('gift-earphones').getSourceImage() as HTMLCanvasElement,head);if(boyGear.band){g.fillStyle='#e7a7c2';g.fillRect(c.width*.82,c.height*.65,Math.max(2,c.width*.025),Math.max(2,c.height*.025))}this.textures.addCanvas(key,c)}const src=this.textures.get(key).getSourceImage() as HTMLCanvasElement;this.pairImage.setTexture(key).setPosition((a.host.x+a.guest.x)/2,Math.max(a.host.y,a.guest.y)).setDisplaySize(this.actorHeight*src.width/src.height,this.actorHeight).setVisible(true).setDepth(10+Math.max(a.host.y,a.guest.y)/1000);this.player.setVisible(false);this.boy.setVisible(false)}finally{save.appearance[remoteWho]=prior;Object.assign(save,saved)}}

 networkEquipment(){return{hat:save.hat,earphones:save.earphones,band:save.band}}
 private renderOnlineEquipment(){const net=this.onlineWorld!;if(!this.onlineBoyGear)this.onlineBoyGear={hat:this.add.image(0,0,'wear-hat'),ear:this.add.image(0,0,'gift-earphones'),band:this.add.image(0,0,'wear-band')};
  for(const who of ['girl','boy'] as const){const actor=who==='girl'?this.player:this.boy,local=(who==='girl')===(net.role==='host'),remote=net.remote,gear=who==='girl'?{hat:this.hat,ear:this.earwear,band:this.band}:this.onlineBoyGear,equipment=local?this.networkEquipment():(remote as typeof remote&{equipment?:{hat:boolean;earphones:boolean;band:boolean}})?.equipment??{hat:false,earphones:false,band:false},facing=local?this.onlineDirection:remote?.position.direction??0,scale=this.actorHeight/64,headWidth=36*scale,headTop=actor.y-actor.displayHeight;
   const hatSource=this.textures.get('wear-hat').getSourceImage() as HTMLCanvasElement,hatWidth=headWidth*.86,hatHeight=hatWidth*hatSource.height/hatSource.width;
   gear.hat.setDisplaySize(hatWidth,hatHeight).setPosition(actor.x,headTop-hatHeight*.03).setVisible(actor.visible&&equipment.hat).setDepth(actor.depth+.03);
   const key='wear-ear-'+facing;if(!this.textures.exists(key)){const canvas=document.createElement('canvas');canvas.width=128;canvas.height=100;drawEarphones(canvas.getContext('2d')!,this.textures.get('gift-earphones').getSourceImage() as HTMLCanvasElement,{x:64,top:0,width:110,height:100,facing});this.textures.addCanvas(key,canvas)}
   gear.ear.setTexture(key).setDisplaySize(headWidth*128/110,headWidth).setPosition(actor.x,headTop+headWidth/2).setVisible(actor.visible&&equipment.earphones).setDepth(actor.depth+.02);gear.band.setDisplaySize(5*scale,3*scale).setPosition(actor.x+(facing===1?-12:12)*scale,actor.y-((local?this.seated:remote?.position.pose?.startsWith('sit'))?14:25)*scale).setVisible(actor.visible&&equipment.band).setDepth(actor.depth+.02);
  }
 }
 resetOnlineControl(){this.onlineSeat=undefined;this.onlinePose='idle';this.onlinePoseUntil=0;this.seated='';this.seatedPhase=0;this.seatTargets=undefined;this.stop();if(this.onlineBoyGear){this.onlineBoyGear.hat.setVisible(false);this.onlineBoyGear.ear.setVisible(false);this.onlineBoyGear.band.setVisible(false)}this.syncFollowing()}
 renderOnlineActor(actor:Phaser.GameObjects.Image,who:'girl'|'boy',direction:number,moving:boolean,pose='idle',appearance?:Record<string,number>){const prior=save.appearance[who];try{if(appearance)save.appearance[who]={hair:appearance.hair??0,color:appearance.color??0,skin:appearance.skin??0,outfit:appearance.outfit??0};if(pose.startsWith('sit'))this.setPose(actor,who,'sit',direction);else if(pose!=='idle'&&pose!=='move')this.setPose(actor,who,'action',pose==='dance'?12+Math.floor(this.idleTime*7)%4:8+Math.floor(this.idleTime*4)%4);else this.renderMoving(actor,who,direction,moving,Math.floor(this.idleTime*8)%4);actor.setDepth(10+actor.y/1000)}finally{save.appearance[who]=prior}}
 private updateOnline(dt:number){this.companionHat.setVisible(false);const net=this.onlineWorld!,local=this.controlledActor,who=net.role==='guest'?'boy':'girl',old={x:local.x,y:local.y};
  if(this.onlineSeat){const seat=this.onlineSeat;seat.elapsed+=dt;const t=Math.min(1,seat.elapsed/.65),ease=t*t*(3-2*t);local.setPosition(seat.from.x+(seat.to.x-seat.from.x)*ease,seat.from.y+(seat.to.y-seat.from.y)*ease);if(seat.standing&&t===1){this.onlineSeat=undefined;this.seated='';this.seatedPhase=0;this.finishStanding()}}
  if(!this.blocked&&this.entered&&!this.onlineSeat){const dx=(this.keys.D.isDown||this.keys.RIGHT.isDown?1:0)-(this.keys.A.isDown||this.keys.LEFT.isDown?1:0)+this.joystick.x,dy=(this.keys.S.isDown||this.keys.DOWN.isDown?1:0)-(this.keys.W.isDown||this.keys.UP.isDown?1:0)+this.joystick.y,d=Math.hypot(dx,dy);if(d>.13&&!net.contactLocksMovement){if(!(net.role==='host'&&net.handWalking))net.cancelAffection();net.cancelFollowing();this.actor.cancel();this.onlinePose='idle';moveWithCollision(local,dx/Math.max(1,d)*84*dt,dy/Math.max(1,d)*84*dt,this.walkable)}else this.actor.update(local,dt,this.walkable)}
  const dx=local.x-old.x,dy=local.y-old.y,moving=Math.hypot(dx,dy)>.01;if(moving&&!this.onlineSeat){this.onlineDirection=Math.abs(dx)>Math.abs(dy)?dx<0?1:3:dy<0?2:0;this.onlinePose='move'}else if(this.idleTime>=this.onlinePoseUntil)this.onlinePose='idle';
  this.renderOnlineActor(local,who,this.onlineSeat?this.seatedFacing:this.onlineDirection,moving,this.onlinePose);this.pairImage?.setVisible(false);net.update(dt);if(net.role==='guest'&&net.snapshot?.following){const dx=local.x-old.x,dy=local.y-old.y,moved=Math.hypot(dx,dy)>.01;if(moved){this.onlineDirection=Math.abs(dx)>Math.abs(dy)?dx<0?1:3:dy<0?2:0;this.onlinePose='move'}this.renderOnlineActor(local,who,this.onlineDirection,moved,moved?'move':'idle')}this.renderOnlineEquipment();if(this.pairImage?.visible){this.hat.setVisible(false);this.earwear.setVisible(false);this.band.setVisible(false);this.onlineBoyGear?.hat.setVisible(false);this.onlineBoyGear?.ear.setVisible(false);this.onlineBoyGear?.band.setVisible(false)}this.shadow.setVisible(this.player.visible).setPosition(this.player.x,this.player.y-1);this.boyShadow.setVisible(this.boy.visible).setPosition(this.boy.x,this.boy.y-1);
  let nearest:Item|undefined;
  for(const item of this.objects){
   if(item.id==='boy'||!inReach(local,item,this.walkable))continue;
   nearest??=item;
   if(item.id===this.focusId){nearest=item;break}
  }
  if(nearest?.id!==this.nearby?.id){this.nearby=nearest;this.bridge.emit('nearby',nearest)}if(nearest)this.bridge.emit('hint-position',this.project(nearest.x,nearest.y-20));this.emitPortalPositions();this.seatLayers?.update();this.windowView?.update();this.atmosphere();this.environment();this.motion?.update(this.idleTime);
 }
 update(_time:number,delta:number){
  if(!this.player)return;this.cloudMotion?.update(delta);this.placeEffects?.update(delta);this.updateCalendar(delta);if(this.leaveFerris){const dt=Math.min(delta,250)/1000;this.idleTime+=dt;this.updateFerris?.(dt);this.motion.update(this.idleTime);return}if(this.entered&&this.blocked&&!this.staging&&!this.onlineWorld?.active)return;this.outdoorEnvironment?.update();this.walkingNow=false;this.frameView();const dt=Math.min(delta,250)/1000;this.idleTime+=dt;this.onlinePets?.update(dt);if(this.onlineWorld?.active){this.updateOnline(dt);return;}
  if(this.staging){this.actor.update(this.player,dt,this.walkable);this.buddy.update(this.boy,dt,this.walkable);if(!this.actor.moving&&!this.buddy.moving){this.staging=false;this.setPose(this.player,'girl','idle',2);this.setPose(this.boy,'boy','idle',2);this.syncFollowing();const done=this.stagingDone;this.stagingDone=undefined;done?.()}}
  if(this.seated)this.updateSeated(dt);else if(this.actionKind&&!this.blocked)this.updateAction(dt);
  if(!this.blocked&&this.entered&&!this.seated&&!this.actionKind){
   let dx=(this.keys.D.isDown||this.keys.RIGHT.isDown?1:0)-(this.keys.A.isDown||this.keys.LEFT.isDown?1:0)+this.joystick.x,dy=(this.keys.S.isDown||this.keys.DOWN.isDown?1:0)-(this.keys.W.isDown||this.keys.UP.isDown?1:0)+this.joystick.y;
   let moving=false;const old={x:this.player.x,y:this.player.y};
   if(Math.hypot(dx,dy)>.13){this.actor.cancel();this.path=[];this.pending=undefined;if(this.movingTo){this.movingTo=undefined;this.bridge.emit('approaching',undefined)}const d=Math.max(1,Math.hypot(dx,dy));dx/=d;dy/=d;moveWithCollision(this.player,dx*84*dt,dy*84*dt,this.walkable);moving=Math.hypot(this.player.x-old.x,this.player.y-old.y)>.001}
   else moving=this.actor.update(this.player,dt,this.walkable);
   if(moving){dx=this.player.x-old.x;dy=this.player.y-old.y;if(Math.abs(dx)+Math.abs(dy)>.05)this.dir=Math.abs(dx)>Math.abs(dy)?(dx<0?1:3):(dy<0?2:0);this.moveTime+=dt;this.player.setAngle(0)}
   else{this.player.setAngle(0);if(this.movingTo){this.face(this.movingTo);this.focusId=this.movingTo.id;this.movingTo=undefined;this.bridge.emit('approaching',undefined)}}
   if(moving)this.lastMotionAt=this.idleTime;const animated=moving||this.idleTime-this.lastMotionAt<.10;this.walkingNow=animated;const phase=Math.floor(this.moveTime*8)%4;if(!this.seated)this.renderMoving(this.player,'girl',this.dir,animated,phase);
  }
  const oldBoy={x:this.boy.x,y:this.boy.y};
  if(this.boyPath.length&&!this.seated)this.advance(this.boy,this.boyPath,87*dt);
  else if(!this.seated&&!this.blocked&&!this.actionKind){const formed=this.holding&&this.handFormation.update(this.boy,this.player,dt,this.walkable,this.actorHeight*.4375);if(!formed)this.follower.update(this.boy,this.player,dt,this.walkable,Boolean(this.movingTo));}
  const boyDx=this.boy.x-oldBoy.x,boyDy=this.boy.y-oldBoy.y;
  if(!this.seated&&!this.actionKind&&Math.hypot(boyDx,boyDy)>.001)this.renderMoving(this.boy,'boy',(Math.abs(boyDx)>Math.abs(boyDy)?boyDx<0?1:3:boyDy<0?2:0),true,Math.floor(this.idleTime*8)%4);else if(!this.seated&&!this.actionKind)this.setPose(this.boy,'boy','idle',this.dir);
  if(this.seated==='swing'&&!save.reduced){const y=149+Math.sin(this.idleTime*2.5)*2;this.player.y=y;this.boy.y=y}
  if(!this.seated&&!this.actionKind){const joined=this.holding&&this.handFormation.active&&!this.blocked;if(joined&&this.pairImage){const key=this.pairTexture(this.dir*4+(this.walkingNow?Math.floor(this.moveTime*8)%4:0),true);this.pairImage.setTexture(key).setPosition((this.player.x+this.boy.x)/2,Math.max(this.player.y,this.boy.y)).setVisible(true).setDepth(10+Math.max(this.player.y,this.boy.y)/1000);const art=this.pairImage.texture.getSourceImage() as HTMLCanvasElement;this.pairImage.setDisplaySize(this.actorHeight*art.width/art.height,this.actorHeight)}else this.pairImage?.setVisible(false);this.player.setVisible(!joined);this.boy.setVisible(!joined)}
  const actorScale=this.actorHeight/64;this.shadow.setDisplaySize(19*actorScale,6*actorScale);this.boyShadow.setDisplaySize(19*actorScale,6*actorScale);this.band.setDisplaySize(5*actorScale,3*actorScale);this.shadow.setPosition(this.player.x,this.player.y-1).setVisible(!this.seated);this.boyShadow.setPosition(this.boy.x,this.boy.y-1).setVisible(!this.seated);
  const facing=this.seated?this.seatedFacing:this.dir,headWidth=36*actorScale,headHeight=36*actorScale,headTop=this.player.y-this.player.displayHeight;
  const hatSource=this.textures.get('wear-hat').getSourceImage() as HTMLCanvasElement;const hatWidth=headWidth*.86,hatHeight=hatWidth*hatSource.height/hatSource.width;
  this.hat.setDisplaySize(hatWidth,hatHeight).setPosition(this.player.x,headTop-hatHeight*.03).setAngle(this.player.angle).setVisible(save.hat&&!this.pairImage?.visible&&!this.integratedWalkGear);
  if(save.earphones&&!this.pairImage?.visible){const key='wear-ear-'+facing;if(!this.textures.exists(key)){const canvas=document.createElement('canvas');canvas.width=128;canvas.height=100;drawEarphones(canvas.getContext('2d')!,this.textures.get('gift-earphones').getSourceImage() as HTMLCanvasElement,{x:64,top:0,width:110,height:100,facing});this.textures.addCanvas(key,canvas)}this.earwear.setTexture(key).setDisplaySize(headWidth*128/110,headHeight).setPosition(this.player.x,headTop+headHeight/2).setVisible(true)}else this.earwear?.setVisible(false);
  this.band.setPosition(this.player.x+(facing===1?-12:12)*actorScale,this.player.y-(this.seated?14:25)*actorScale).setVisible(save.band&&!this.pairImage?.visible&&!this.integratedWalkGear);this.player.setDepth(this.hasSeatedBody?11:10+this.player.y/1000);this.boy.setDepth(this.hasSeatedBody?11:10+this.boy.y/1000);const accessoryDepth=this.player.depth+.02;this.companionHat.setDisplaySize(hatWidth,hatWidth*.9).setPosition(this.boy.x,this.boy.y-this.boy.displayHeight).setDepth(this.boy.depth+.03).setVisible(save.companionHat&&this.boy.visible);this.hat.setDepth(accessoryDepth+.01);this.earwear.setDepth(accessoryDepth);this.band.setDepth(accessoryDepth);

  const npc=this.getItem('boy');if(npc){npc.x=this.boy.x;npc.y=this.boy.y-14;const options=[[-27,0],[27,0],[0,27],[0,-27]].map(([x,y])=>({x:this.boy.x+x,y:this.boy.y+y})).filter(p=>this.walkable(p)).sort((a,b)=>Math.hypot(a.x-this.player.x,a.y-this.player.y)-Math.hypot(b.x-this.player.x,b.y-this.player.y));const approach=options[0]??this.boy;npc.point=[approach.x,approach.y]}
  let nearest:Item|undefined;
  if(!this.actionKind&&!(this.holding&&this.handFormation.active)&&!this.seated){
   let closest=Infinity;
   for(const item of this.objects){
    if(!inReach(this.player,item,this.walkable))continue;
    if(item.id===this.focusId){nearest=item;break}
    const distance=Math.hypot(item.point[0]-this.player.x,item.point[1]-this.player.y);
    if(distance<closest){closest=distance;nearest=item}
   }
  }
  if(nearest?.id!==this.nearby?.id){this.nearby=nearest;this.bridge.emit('nearby',nearest)}
  this.glow.clear();if(this.nearby&&!this.blocked&&!this.seated&&!this.movingTo){this.glow.lineStyle(1,0xffe3a5,.7);this.glow.strokeEllipse(this.nearby.x,this.nearby.y+5,26,10);this.bridge.emit('hint-position',this.project(this.nearby.x,this.nearby.y-20))}
  this.emitPortalPositions();this.seatLayers?.update();this.windowView?.update();this.atmosphere();this.environment();this.motion?.update(this.idleTime);if(this.entered&&!this.blocked&&!this.seated&&!this.movingTo){const game=this.objects.find(i=>i.id.startsWith('game-')&&!this.autoGames.has(this.zone+':'+i.id)&&Math.hypot(i.point[0]-this.player.x,i.point[1]-this.player.y)<13);if(game){this.autoGames.add(this.zone+':'+game.id);this.stop();this.bridge.emit('interact',game.id)}}
  if(!this.blocked&&this.entered&&!this.seated&&this.zone==='room'&&this.player.y>=376&&Math.abs(this.player.x-320)<18){this.blocked=true;this.stop();this.bridge.emit('interact','door')}
 }
}
