import {HandFormation} from './hand-formation';
import {indoorZones,renderWindowWeather} from './window-weather';
import {furnishings,furnishingSeats} from './layouts';
import Phaser from 'phaser';
import {birthdayConfig as config} from '../content/birthday-config';
import {save,persist,grantItem} from './state';
import {Signals} from './signals';
import {assetUrl,textureFiles,coreTextureKeys} from './assets';
import {findPath,advanceAlong,moveWithCollision,nearestWalkable,type Point} from './navigation';
import {WorldMotion} from './world-motion';
import {ActorController,actions} from './actors';
import {FootstepFollower} from './follow';
import {worlds,entrySpawn,inReach,type Zone,type Item} from './world';
export type {Zone,Item} from './world';
export class Cottage extends Phaser.Scene {
 readonly bridge=new Signals();
 private walkingNow=false;private afterStand?:()=>void;private staging=false;private stagingDone?:()=>void;private filmTextures:string[]=[];
 private get bootKeys(){return save.celebrated?[...coreTextureKeys,'room-after' as const]:[...coreTextureKeys]}
 private handFormation=new HandFormation();private motion!:WorldMotion;private pairImage?:Phaser.GameObjects.Image;
 readonly actor=new ActorController();private buddy=new ActorController();private sceneCache:string[]=[];private actionTime=0;private actionKind='';private pairReady=false;private seatedPhase=0;private seatTargets?:number[];
 private autoGames=new Set<string>();
 weather='clear'; daylight='night'; holding=false;
 blocked=true;entered=false;zone:Zone='room';nearby:Item|undefined;joystick={x:0,y:0};seated='';movingTo:Item|undefined;
 player!:Phaser.GameObjects.Image;boy!:Phaser.GameObjects.Image;hat!:Phaser.GameObjects.Image;band!:Phaser.GameObjects.Rectangle;earwear!:Phaser.GameObjects.Image;
 private background!:Phaser.GameObjects.Image;private shadow!:Phaser.GameObjects.Ellipse;private boyShadow!:Phaser.GameObjects.Ellipse;
 private trail!:Phaser.GameObjects.Graphics;private glow!:Phaser.GameObjects.Graphics;private effects!:Phaser.GameObjects.Graphics;
 private markers:Phaser.GameObjects.Container[]=[];private giftMarkers=new Map<string,Phaser.GameObjects.Container>();private props=new Map<string,Phaser.GameObjects.Image>();private objects:Item[]=[];
 private keys!:Record<string,Phaser.Input.Keyboard.Key>;private path:Point[]=[];private boyPath:Point[]=[];private pending?:()=>void;private moveTime=0;private idleTime=0;private follower=new FootstepFollower();private dir=0;private starTime=0;private focusId='';private sitReturn?:Point;private boyReturn?:Point;
 private failedAssets=new Set<string>();private readyToEnter=false;
 private cakeDark!:Phaser.GameObjects.Rectangle;private sparkles:Phaser.GameObjects.Rectangle[]=[];
 constructor(){super('cottage')}
 preload(){
  this.failedAssets.clear();this.readyToEnter=false;
  for(const key of this.bootKeys)this.load.image(key,assetUrl(textureFiles[key]));
  this.load.on('progress',(progress:number)=>this.bridge.emit('load-progress',progress));
  this.load.on('loaderror',(file:{key:string})=>{this.failedAssets.add(file.key);this.bridge.emit('asset-error',file.key)});
 }

 private sliceAtlas(source:string,cols:number,rows:number,names:string[]){
  if(!this.textures.exists(source))return;const img=this.textures.get(source).getSourceImage() as HTMLImageElement;
  for(let index=0;index<names.length;index++){if(this.textures.exists(names[index]))continue;
   const row=Math.floor(index/cols),actualCols=source==='boy-actions'&&row===3?5:cols,col=index%cols;const left=Math.round(col*img.width/actualCols),top=Math.round(row*img.height/rows),width=Math.round((col+1)*img.width/actualCols)-left,height=Math.round((row+1)*img.height/rows)-top;
   const cell=document.createElement('canvas');cell.width=width;cell.height=height;const ctx=cell.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.drawImage(img,left,top,width,height,0,0,width,height);
   const pixels=ctx.getImageData(0,0,width,height).data;let x0=width,y0=height,x1=-1,y1=-1;
   for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(pixels[(y*width+x)*4+3]>64){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}
   const trim=document.createElement('canvas');trim.width=Math.max(1,x1-x0+1);trim.height=Math.max(1,y1-y0+1);const target=trim.getContext('2d')!;target.imageSmoothingEnabled=false;if(x1>=x0)target.drawImage(cell,x0,y0,trim.width,trim.height,0,0,trim.width,trim.height);this.textures.addCanvas(names[index],trim);
  }
 }
 create(){
  this.readyToEnter=false;for(const key of this.bootKeys)if(!this.textures.exists(key))this.failedAssets.add(key);if(this.failedAssets.size){this.bridge.emit('asset-error',[...this.failedAssets]);return}
  this.sliceAtlas('characters',4,2,['legacy-girl0','legacy-girl1','legacy-girl2','legacy-girl3','boy0','boy1','boy2','boy3']);this.sliceAtlas('hero',4,4,['girl0','girl1','girl2','girl3','girl-walk-a0','girl-walk-a1','girl-walk-a2','girl-walk-a3','girl-walk-b0','girl-walk-b1','girl-walk-b2','girl-walk-b3','girl-portrait','girl-portrait-left','pink-case','cat-bag']);this.sliceAtlas('gifts',4,3,config.gifts.map(g=>'gift-'+g.id));this.sliceAtlas('props',4,2,Array.from({length:8},(_,i)=>'prop-'+i));
  this.sliceAtlas('sitting',2,2,['sit-girl','sit-boy','sit-girl-back','sit-boy-back']);
  this.background=this.add.image(0,0,this.backgroundKey).setOrigin(0).setDisplaySize(640,426.667).setDepth(0);this.trail=this.add.graphics().setDepth(2);this.glow=this.add.graphics().setDepth(3);this.effects=this.add.graphics().setDepth(8);
  this.shadow=this.add.ellipse(320,356,19,6,0x2d2030,.3).setDepth(5);this.boyShadow=this.add.ellipse(365,343,19,6,0x2d2030,.3).setDepth(5);
  this.player=this.add.image(320,356,'girl0').setOrigin(.5,1).setDisplaySize(23,37).setDepth(10);this.boy=this.add.image(363,338,'boy0').setOrigin(.5,1).setDisplaySize(24,37).setDepth(9);
  this.hat=this.add.image(0,0,'gift-hat').setDisplaySize(28,20).setDepth(12);this.band=this.add.rectangle(0,0,2,2,0xe7a7c2).setDepth(12);
  this.earwear=this.add.image(0,0,'gift-earphones').setDisplaySize(16,16).setDepth(13);
  this.cakeDark=this.add.rectangle(320,213.333,640,426.667,0x0b1022,.5).setDepth(20).setVisible(false);
  this.keys=this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E') as Record<string,Phaser.Input.Keyboard.Key>;this.input.keyboard!.on('keydown-E',()=>{if(!this.blocked&&!this.seated)this.interactNearest()});
  this.buildActionFrames();this.motion=new WorldMotion(this);this.rebuild();this.resizeView();this.syncFollowing();this.readyToEnter=true;this.bridge.emit('cottage-ready');
 }
 setFollowing(enabled:boolean){if(!enabled){this.holding=false;this.handFormation.reset()}save.following=enabled;persist();this.syncFollowing();this.bridge.emit('following',enabled)}
 syncFollowing(){if(this.player&&this.boy)this.follower.setEnabled(save.following,this.player,this.boy,this.walkable)}
 private queuedAction='';
 approachForAction(kind:string){if(this.blocked)return;if(this.seated){this.whenStanding(()=>this.approachForAction(kind));return;}this.queuedAction=kind;const target=this.getItem('boy');if(!target)return;this.stop();this.queuedAction=kind;if(inReach(this.player,target,this.walkable)){this.queuedAction='';this.affection(kind)}else this.walk({x:target.point[0],y:target.point[1]},()=>{const next=this.queuedAction;this.queuedAction='';if(next)this.affection(next)})}
 poseSource(who:'girl'|'boy',frame:number){const key=this.appearanceKey(who,who+'-pose-'+frame);return this.textures.exists(key)?this.textures.get(key).getSourceImage() as HTMLCanvasElement:undefined}
 avatar(who:'girl'|'boy'){const source=this.poseSource(who,0);return source?.toDataURL()??''}
 refreshAppearance(){for(const who of ['girl','boy'] as const){const prefix=who+'-styled-';for(const key of this.textures.getTextureKeys())if(key.startsWith(prefix)||((key.startsWith('pair-art-')||key.startsWith('holding-art-'))&&key.includes('{')))this.textures.remove(key)}this.setPose(this.player,'girl',this.seated?'sit':'idle',0);this.setPose(this.boy,'boy',this.seated?'sit':'idle',0)}
 private appearanceKey(who:'girl'|'boy',base:string){if(!this.textures.exists(base))return base;const a=save.appearance[who],key=who+'-styled-'+base+'-'+[a.hair,a.color,a.skin,a.outfit].join('-');if(this.textures.exists(key))return key;const source=this.textures.get(base).getSourceImage() as HTMLCanvasElement,c=document.createElement('canvas');c.width=source.width;c.height=source.height;const g=c.getContext('2d')!;g.drawImage(source,0,0);if(a.hair>0&&!base.startsWith('pair-')&&!base.startsWith('holding-')&&!base.startsWith('head-')){const index=Number(base.split('-').at(-1)),dir=base.includes('-stride-')?Math.floor(index/4):index<4?index:index<8?index-4:0;const headKey=who+'-head-'+(a.hair*4+dir);if(this.textures.exists(headKey)){const head=this.textures.get(headKey).getSourceImage() as HTMLCanvasElement;const h=c.height*(who==='girl'?.59:.51),w=h*head.width/head.height;g.clearRect(0,0,c.width,h);g.drawImage(head,(c.width-w)/2,0,w,h)}}const image=g.getImageData(0,0,c.width,c.height),pixels=image.data;const hair=[[146,117,111],[91,55,39],[44,39,41],[161,64,57],[213,180,120],[185,124,147]][a.color],skin=[[255,215,187],[234,187,147],[193,136,95],[141,89,64]][a.skin],clothes=[[116,160,187],[197,125,148],[230,220,192]][a.outfit];for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const n=(y*c.width+x)*4,r=pixels[n],v=pixels[n+1],b=pixels[n+2];if(pixels[n+3]<100)continue;const isSkin=r>v*1.12&&v>b*1.05&&r>160&&v>90;if(isSkin&&y<c.height*.88){if(a.skin===0)continue;const shade=(r+v+b)/630;pixels[n]=skin[0]*shade;pixels[n+1]=skin[1]*shade;pixels[n+2]=skin[2]*shade}else if(a.color>0&&y<c.height*.56&&!isSkin&&Math.max(r,v,b)-Math.min(r,v,b)<80){const shade=(r+v+b)/420;pixels[n]=Math.min(255,hair[0]*shade);pixels[n+1]=Math.min(255,hair[1]*shade);pixels[n+2]=Math.min(255,hair[2]*shade)}else if(a.outfit>0&&y>c.height*.5&&y<c.height*.8&&((b>r*1.05)||(v>r*1.02&&v>b*.9))){const shade=(r+v+b)/460;pixels[n]=clothes[0]*shade;pixels[n+1]=clothes[1]*shade;pixels[n+2]=clothes[2]*shade}}g.putImageData(image,0,0);this.textures.addCanvas(key,c);return key}
 private async ensureTexture(key:keyof typeof textureFiles){if(this.textures.exists(key))return;await new Promise<void>((resolve,reject)=>{const image=new Image();image.onload=()=>{if(!this.textures.exists(key))this.textures.addImage(key,image);resolve()};image.onerror=reject;image.src=assetUrl(textureFiles[key])})}
 async prepareBirthday(){await Promise.all([this.ensureTexture('pier'),this.ensureTexture('room-after')])}
 async prepareCinema(){this.filmTextures=[];for(const key of ['garden','forest','pier'] as const){if(!this.textures.exists(key))this.filmTextures.push(key);await this.ensureTexture(key)}}
 releaseCinema(){for(const key of this.filmTextures)if(key!==this.backgroundKey&&!this.sceneCache.includes(key))this.textures.remove(key);this.filmTextures=[]}
 private async ensureZone(zone:Zone){if(furnishings[zone]){await this.ensureTexture('furniture');this.sliceAtlas('furniture',4,4,Array.from({length:16},(_,i)=>'furnishing-'+i))}if(['magic','haunted','ferris'].includes(zone)){await this.ensureTexture('wheel-actors');this.sliceAtlas('wheel-actors',2,2,['motion-wheel','motion-cabin','motion-ghost','motion-book'])}const key=worlds[zone].texture;if(!this.textures.exists(key)){const file=textureFiles[key as keyof typeof textureFiles];if(!file)throw Error(key);await new Promise<void>((resolve,reject)=>{const image=new Image();image.onload=()=>{if(!this.textures.exists(key))this.textures.addImage(key,image);resolve()};image.onerror=reject;image.src=assetUrl(file)})}this.sceneCache=this.sceneCache.filter(k=>k!==key);this.sceneCache.push(key);while(this.sceneCache.length>3){const old=this.sceneCache.shift()!;if(!coreTextureKeys.includes(old as any))this.textures.remove(old)}for(const exit of worlds[zone].items.filter(i=>i.to).slice(0,2)){const next=worlds[exit.to!].texture;if(!this.textures.exists(next)){const image=new Image();image.src=assetUrl(textureFiles[next as keyof typeof textureFiles])}}}
 private renderMoving(actor:Phaser.GameObjects.Image,who:'girl'|'boy',dir:number,moving:boolean,phase:number){const base=who+'-stride-'+(dir*4+phase);if(moving&&this.textures.exists(base)){actor.setTexture(this.appearanceKey(who,base));const src=actor.texture.getSourceImage() as HTMLCanvasElement;actor.setDisplaySize(64*src.width/src.height,64)}else this.setPose(actor,who,'idle',dir)}
 private buildActionFrames(){this.sliceAtlas('holding-walk',4,4,Array.from({length:16},(_,i)=>'holding-art-'+i));this.sliceAtlas('furniture',4,4,Array.from({length:16},(_,i)=>'furnishing-'+i));this.sliceAtlas('couple-actions',4,3,Array.from({length:12},(_,i)=>'pair-art-'+i));this.pairImage=this.add.image(0,0,'pair-art-0').setOrigin(.5,1).setDepth(15).setVisible(false);for(const who of ['girl','boy']){this.sliceAtlas(who+'-heads',4,4,Array.from({length:16},(_,i)=>who+'-head-'+i));for(let i=0;i<16;i++)this.textures.addCanvas('head-'+who+'-head-'+i,this.textures.get(who+'-head-'+i).getSourceImage() as HTMLCanvasElement)}this.sliceAtlas('world-actors',4,4,[...Array.from({length:4},(_,i)=>'train-'+i),...Array.from({length:4},(_,i)=>'jelly-'+i),...Array.from({length:4},(_,i)=>'fish-'+i),...Array.from({length:4},(_,i)=>'flame-'+i)]);this.sliceAtlas('wheel-actors',2,2,['motion-wheel','motion-cabin','motion-ghost','motion-book']);for(const who of ['girl','boy'])if(this.textures.exists(who+'-walk'))this.sliceAtlas(who+'-walk',4,4,Array.from({length:16},(_,i)=>who+'-stride-'+i));for(const who of ['girl','boy'])this.sliceAtlas(who+'-actions',4,4,Array.from({length:16},(_,i)=>who+'-pose-'+i));this.sliceAtlas('icons-v2',4,4,['ui-music','ui-journal','ui-photo','ui-fullscreen','ui-settings','ui-map','ui-companion','ui-sky','ui-bag','ui-flower','ui-portrait','ui-letter','ui-sign','ui-door','ui-home','ui-wand']);this.sliceAtlas('gifts-v2',2,2,['red-doll','red-earphones','pink-band','white-hat']);for(const [id,key]of [['doll','red-doll'],['earphones','red-earphones'],['band','pink-band'],['hat','white-hat']]){this.textures.remove('gift-'+id);const source=this.textures.get(key).getSourceImage() as HTMLCanvasElement;this.textures.addCanvas('gift-'+id,source)}}
 private setPose(actor:Phaser.GameObjects.Image,who:'girl'|'boy',pose:string,dir:number){const index=pose==='sit'?4+dir:pose==='action'?dir:dir;const key=who+'-pose-'+index;if(this.textures.exists(key)){actor.setTexture(this.appearanceKey(who,key));const src=actor.texture.getSourceImage() as HTMLCanvasElement;const ref=this.textures.get(who+'-pose-0').getSourceImage() as HTMLCanvasElement;const scale=64/ref.height;actor.setDisplaySize(src.width*scale,src.height*scale)}}
 get backgroundKey(){return this.zone==='room'&&save.celebrated?'room-after':worlds[this.zone].texture}
 get walkable(){return worlds[this.zone].walkable}
 getItem(id:string){return this.objects.find(item=>item.id===id)}
 tapWorld(x:number,y:number){
  if(this.blocked||!this.entered||this.seated)return;
  const candidates=this.objects.filter(item=>Math.hypot(item.x-x,item.y-y)<(item.id==='boy'?16:30)).sort((a,b)=>(a.id==='boy'?12:0)+Math.hypot(a.x-x,a.y-y)-(b.id==='boy'?12:0)-Math.hypot(b.x-x,b.y-y));
  if(candidates[0])this.approach(candidates[0]);else{this.focusId='';this.walk({x,y});this.bridge.emit('destination',{x,y})}
 }
 approachById(id:string){const item=this.getItem(id);if(item)this.approach(item)}
 resizeView(){if(!this.cameras?.main)return;const camera=this.cameras.main;camera.setZoom(Math.max(camera.width/640,camera.height/426.667));this.frameView()}
 private frameView(){const c=this.cameras.main,halfH=c.height/c.zoom/2,halfW=c.width/c.zoom/2;const y=this.entered?Phaser.Math.Clamp(this.player.y-80,halfH,426.667-halfH):213.333;c.centerOn(this.entered?Phaser.Math.Clamp(this.player.x,halfW,640-halfW):320,y)}
 project(x:number,y:number){const c=this.cameras.main;return{x:(x-c.worldView.x)*c.zoom,y:(y-c.worldView.y)*c.zoom}}
 async transitionTo(zone:Zone,done:()=>void){
  this.blocked=true;this.stop();try{await this.ensureZone(zone)}catch{this.blocked=false;this.bridge.emit('zone-error');return}
  this.blocked=true;this.stop();this.clearHint();const camera=this.cameras.main,duration=save.reduced?1:300;
  camera.once('camerafadeoutcomplete',()=>{this.changeZone(zone);this.resizeView();camera.once('camerafadeincomplete',()=>{this.blocked=false;done()});camera.fadeIn(duration,19,17,28)});camera.fadeOut(duration,19,17,28);
 }
 private rebuild(){
  this.motion?.rebuild();this.markers.forEach(m=>m.destroy());this.markers=[];this.giftMarkers.clear();this.props.clear();this.trail.clear();for(const prop of furnishings[this.zone]??[]){const icon=this.add.image(0,0,'furnishing-'+prop.frame).setOrigin(.5,1).setDisplaySize(prop.w,prop.h);this.markers.push(this.add.container(prop.x,prop.y,[icon]).setDepth(prop.floor?1:10+prop.y/1000));this.props.set(prop.id,icon)}
  const gifts=this.zone==='room'?config.gifts.map(g=>({...g})):[];
  this.objects=[...gifts,...worlds[this.zone].items.map(item=>({...item})),{id:'boy',name:config.boyName==='我'?'等你的那个人':config.boyName,action:'说说话',x:this.boy.x,y:this.boy.y-14,point:[this.boy.x-27,this.boy.y]}];
  for(const g of gifts){const opened=save.opened.includes(g.id);const icon=this.add.image(0,0,opened?'gift-'+g.id:(g.id==='mystery'?'gift-mystery':'gift-labubu')).setDisplaySize(g.id==='moon'&&opened?22:16,17);const group=this.add.container(g.x,g.y,[icon]).setDepth(4);this.markers.push(group);this.giftMarkers.set(g.id,group);if(opened){this.trail.fillStyle(0xe9c5b3,.85);this.trail.fillRect(g.point[0]+8,g.point[1]+2,6,3);this.trail.fillStyle(0xbd6683);this.trail.fillRect(g.point[0]+10,g.point[1]+1,2,5)}}
 for(const item of worlds[this.zone].items){
   if(item.prop!==undefined||item.texture){const icon=this.add.image(0,0,item.texture??'prop-'+item.prop).setOrigin(.5,1).setDisplaySize(item.prop===7?20:25,item.prop===7?27:26);const group=this.add.container(item.x,item.y+5,[icon]).setDepth(4);this.markers.push(group);this.props.set(item.id,icon)}
   const placed=save.placements[this.zone+':'+item.id];if(placed){const texture=this.textures.exists('gift-'+placed)?'gift-'+placed:placed==='shell'?'prop-5':placed==='lantern'?'prop-0':'gift-notes';const icon=this.add.image(0,0,texture).setOrigin(.5,1).setDisplaySize(20,22);this.markers.push(this.add.container(item.x,item.y,[icon]).setDepth(7))}else if(item.kind==='collect'&&!save.inventory.includes(item.collect??'')){const icon=this.add.image(0,0,item.collect==='flower'?'ui-flower':item.collect==='shell'?'prop-5':'ui-letter').setDisplaySize(18,18);this.markers.push(this.add.container(item.x,item.y,[icon]).setDepth(7))}
   if(item.to){const icon=this.add.image(0,0,'ui-sign').setDisplaySize(24,24);this.markers.push(this.add.container(item.x,item.y-8,[icon]).setDepth(6))}
  }
  this.hat.setVisible(save.hat&&!this.pairImage?.visible);this.band.setVisible(save.band);this.earwear?.setVisible(save.earphones);this.clearHint();
 }
 refresh(){this.background.setTexture(this.backgroundKey);this.rebuild()}
 enter(){if(!this.readyToEnter||this.entered)return;this.entered=true;this.blocked=false;this.player.setTexture('girl2');this.dir=2;this.cameras.main.fadeIn(save.reduced?1:850,25,19,27)}
 walk(point:Point,callback?:()=>void){if(this.actionKind)this.stop();if(this.movingTo){this.movingTo=undefined;this.bridge.emit('approaching',undefined)}this.path=findPath(this.player,point,this.walkable);this.pending=this.path.length?callback:undefined;this.actor.move(this.player,point,this.walkable,()=>{this.movingTo=undefined;this.bridge.emit('approaching',undefined);const next=this.pending;this.pending=undefined;next?.()});if(!this.path.length)this.bridge.emit('unreachable')}
 approach(item:Item){
  if(this.blocked)return;if(this.seated){this.whenStanding(()=>this.approach(item));return;}this.focusId=item.id;
  if(inReach(this.player,item,this.walkable)){this.stop();this.face(item);this.trigger(item);return}
  this.walk({x:item.point[0],y:item.point[1]},()=>this.trigger(item));this.movingTo=this.path.length?item:undefined;this.bridge.emit('approaching',this.movingTo);
 }
 private face(item:Item){const dx=item.x-this.player.x,dy=item.y-this.player.y;this.dir=Math.abs(dx)>Math.abs(dy)?(dx<0?1:3):(dy<0?2:0);this.player.setTexture('girl'+this.dir)}
 private trigger(item:Item){if(this.blocked||!inReach(this.player,item,this.walkable))return;this.path=[];this.bridge.emit('interact',item.id)}
 interactNearest(){if(this.nearby)this.approach(this.nearby)}
 clearHint(){this.nearby=undefined;this.bridge.emit('nearby',undefined)}
 stop(){this.afterStand=undefined;this.handFormation.reset();this.staging=false;this.stagingDone=undefined;const acting=Boolean(this.actionKind);this.pairImage?.setVisible(false);this.player?.setVisible(true).setAngle(0);this.boy?.setVisible(true).setAngle(0);if(acting&&this.player&&this.boy){this.setPose(this.player,'girl','idle',0);this.setPose(this.boy,'boy','idle',0)}this.queuedAction='';this.actor.cancel();this.buddy.cancel();this.actionKind='';this.actionTime=0;this.joystick={x:0,y:0};this.path=[];this.pending=undefined;this.boyPath=[];this.movingTo=undefined;this.bridge.emit('approaching',undefined);Object.values(this.keys||{}).forEach(k=>k.reset())}
 changeZone(zone:Zone){
  if(this.seated){this.seated='';this.seatTargets=undefined;this.seatedPhase=0;this.bridge.emit('stood')}const previous=this.zone;this.stop();this.zone=zone;if(!save.visited.includes(zone)){save.visited.push(zone);persist()}this.focusId='';this.background.setTexture(this.backgroundKey).setDisplaySize(640,426.667);
  const spawn=entrySpawn(previous,zone);this.player.setPosition(...spawn);const point={x:spawn[0]+22,y:spawn[1]-10};const near=findPath(this.player,point,this.walkable).at(-1);this.boy.setPosition(near?.x??worlds[zone].boy[0],near?.y??worlds[zone].boy[1]);
  this.boyPath=[];this.player.setTexture('girl0');this.boy.setTexture('boy0');if(zone==='garden'){save.visitedGarden=true;persist()}this.rebuild();this.frameView();this.syncFollowing();this.bridge.emit('zone',zone);
 }
 sit(kind:string){
  if(this.seated){this.whenStanding(()=>this.sit(kind));return}this.stop();
  const positions:Record<string,number[]>={'magic-seat':[99,177,126,177],'haunted-seat':[117,172,146,172],'cinema-seat':[80,178,158,178],'ferris-seat':[72,204,141,204],'mars-seat':[54,151,80,151],'memory-seat':[100,191,185,191],'aquarium-seat':[184,185,210,185],'camp-seat':[151,160,177,160],'station-seat':[164,170,190,170],'postal-seat':[155,183,181,183],'chair-left':[253,206,388,206],'chair-right':[388,206,253,206],'greenhouse-seat':[132,140,155,140],sofa:[68,288,101,288],tea:[68,288,101,288],swing:[292,149,324,149],bench:[135,194,163,194],sea:[484,250,508,250],window:[325,145,352,145],picnic:[139,205,167,205],oak:[524,190,551,190],fireflies:[278,304,303,304],'pier-bench':[258,199,285,199],starlight:[403,218,431,218],tide:[363,289,389,289]};
  const hips=furnishingSeats(this.zone,kind)??({'hotspring-seat':[258,201,408,204],'market-seat':[63,237,173,241],'aurora-seat':[211,241,433,245]} as Record<string,number[]>)[kind];const p=hips?[...hips]:positions[kind];if(hips){for(const [who,index]of [['girl',1],['boy',3]] as const){const pose=this.textures.get(who+'-pose-4').getSourceImage() as HTMLCanvasElement,ref=this.textures.get(who+'-pose-0').getSourceImage() as HTMLCanvasElement;p![index]+=pose.height*64/ref.height*(who==='girl'?.24:.30)}}if(!p){this.bridge.emit('unreachable');return}const floor=this.walkable;const girl=nearestWalkable({x:p[0],y:p[1]+28},floor,110),boy=nearestWalkable({x:p[2],y:p[3]+28},floor,110);if(!girl||!boy)return;
  this.seatTargets=p;this.seated=kind;this.seatedPhase=0;this.actor.move(this.player,girl,floor);this.buddy.move(this.boy,boy,floor);this.sitReturn=girl;this.boyReturn=boy;this.clearHint();this.bridge.emit('seated',kind);
 }
 private whenStanding(next:()=>void){if(!this.seated){next();return}this.afterStand=next;if(this.seatedPhase>=0)this.stand()}
 private finishStanding(){const next=this.afterStand;this.afterStand=undefined;next?.()}
 stand(){if(!this.seated)return;if(this.seatedPhase===0){this.actor.cancel();this.buddy.cancel();this.seated='';this.seatTargets=undefined;this.bridge.emit('stood');this.syncFollowing();this.finishStanding();return}const p=this.seatTargets;this.seatedPhase=-.001;this.actionTime=0;this.bridge.emit('stood');if(!p){this.seated='';return}}
 private updateSeated(dt:number){const p=this.seatTargets;if(!p)return;const floor=this.walkable;
  if(this.seatedPhase===0){this.actor.update(this.player,dt,floor);this.buddy.update(this.boy,dt,floor);if(!this.actor.moving&&!this.buddy.moving)this.seatedPhase=.001;return}
  const standing=this.seatedPhase<0;this.seatedPhase+=standing?-dt:dt;const t=Math.min(1,Math.abs(this.seatedPhase)/.4);const ease=t*t*(3-2*t);for(const [actor,base,floorPoint,who]of [[this.player,0,this.sitReturn,'girl'],[this.boy,2,this.boyReturn,'boy']] as const){if(!floorPoint)continue;actor.setPosition(standing?p[base]+(floorPoint.x-p[base])*ease:floorPoint.x+(p[base]-floorPoint.x)*ease,standing?p[base+1]+(floorPoint.y-p[base+1])*ease:floorPoint.y+(p[base+1]-floorPoint.y)*ease);const back=['sea','window','starlight','tide'].includes(this.seated);this.setPose(actor,who,standing&&t>.65?'idle':'sit',back?2:0)}
  if(t===1&&standing){this.seated='';this.seatTargets=undefined;this.actor.cancel();this.buddy.cancel();this.syncFollowing();this.finishStanding()}
 }
 remember(id:string){if(id==='shell')grantItem('shell');if(id==='lanterns'||id==='camp-lights')grantItem('lantern');if(id==='starlight'||id==='telescope')this.starTime=this.idleTime;if(!save.moments.includes(id)){save.moments.push(id);persist()}this.animatePlace(id);if(id==='ghost'||id==='ghost-box')this.affection('scare');if(['popcorn','marshmallow','market-bread','spring-tea','aurora-tea','memory-tea'].includes(id))this.affection('share');if(id==='mars-dance')this.affection('dance');if(id==='spell')this.affection('flower');if(id==='paper-plane')this.releasePlane();if(id==='station-bell'){this.bridge.emit('station-chime')}if(id==='postmark')this.confetti()}
 animatePlace(id:string){const icon=this.props.get(id);if(icon&&!save.reduced)this.tweens.add({targets:icon,angle:id==='chime'?13:0,y:icon.y-3,duration:220,yoyo:true,repeat:2})}
 arrangeCake(callback:()=>void){if(this.zone!=='room')return;this.stop();this.staging=true;this.stagingDone=callback;this.actor.move(this.player,{x:278,y:274},this.walkable);this.buddy.move(this.boy,{x:364,y:274},this.walkable)}
 darken(show:boolean){this.cakeDark.setVisible(show);if(this.zone==='room')this.background.setTexture(show?'room':this.backgroundKey)}
 confetti(){if(save.reduced)return;for(let i=0;i<55;i++){const r=this.add.rectangle(200+Math.random()*240,-10-Math.random()*70,2+Math.random()*2,4,[0xeed39c,0xbc7b92,0x9cae83,0xf5e8c8][i%4]).setDepth(30);this.sparkles.push(r);this.tweens.add({targets:r,y:300+Math.random()*100,x:r.x+Math.random()*70-35,angle:Math.random()*360,alpha:0,duration:2600+Math.random()*2000,onComplete:()=>r.destroy()})}}
 animateGift(id:string){const g=config.gifts.find(x=>x.id===id);if(!g)return;const group=this.giftMarkers.get(id);if(!group||save.reduced)return;this.tweens.add({targets:group,y:group.y-5,angle:id==='keychain'?12:0,duration:150,yoyo:true,repeat:1})}
 capture(callback:(image:HTMLImageElement)=>void){
 const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=854;const ctx=canvas.getContext('2d')!;ctx.imageSmoothingEnabled=false;
 const background=this.textures.get(this.backgroundKey).getSourceImage() as HTMLImageElement;ctx.drawImage(background,0,0,1280,854);
 for(const prop of furnishings[this.zone]??[]){const art=this.textures.get('furnishing-'+prop.frame).getSourceImage() as HTMLCanvasElement;ctx.drawImage(art,(prop.x-prop.w/2)*2,(prop.y-prop.h)*2,prop.w*2,prop.h*2)}
 for(const item of worlds[this.zone].items){if(item.prop!==undefined||item.texture){const src=this.textures.get(item.texture??'prop-'+item.prop).getSourceImage() as HTMLCanvasElement;ctx.drawImage(src,(item.x-12.5)*2,(item.y-21)*2,50,52)}}
 const draw=(actor:Phaser.GameObjects.Image)=>{const source=actor.texture.getSourceImage() as HTMLCanvasElement;ctx.drawImage(source,(actor.x-actor.displayWidth/2)*2,(actor.y-actor.displayHeight)*2,actor.displayWidth*2,actor.displayHeight*2)};
 for(const actor of [this.player,this.boy].sort((a,b)=>a.y-b.y)){ctx.fillStyle='#2d203055';ctx.beginPath();ctx.ellipse(actor.x*2,actor.y*2,18,5,0,0,Math.PI*2);ctx.fill();draw(actor)}
 if(save.hat){const source=this.textures.get('gift-hat').getSourceImage() as HTMLCanvasElement;ctx.drawImage(source,(this.hat.x-this.hat.displayWidth/2)*2,(this.hat.y-this.hat.displayHeight/2)*2,this.hat.displayWidth*2,this.hat.displayHeight*2)}
 if(save.band){ctx.fillStyle='#e7a7c2';ctx.fillRect(this.band.x*2,this.band.y*2,4,4)}
 const image=new Image();image.onload=()=>callback(image);image.src=canvas.toDataURL('image/png');
 }
 private advance(actor:Phaser.GameObjects.Image,path:Point[],distance:number){return advanceAlong(actor,path,distance,this.walkable)>.001}

 affection(kind:string){if(this.seated||this.actionKind)return;this.stop();if(kind==='hand'){this.holding=!this.holding;if(this.holding)this.setFollowing(true);return}const target=nearestWalkable({x:this.player.x+18,y:this.player.y},this.walkable,24);if(!target){this.bridge.emit('unreachable');return}this.actionKind=kind;this.actionTime=0;this.pairReady=false;this.actor.state='preparing';this.buddy.move(this.boy,target,this.walkable,()=>{this.pairReady=true;this.actionTime=0});if(!this.buddy.moving){this.pairReady=true}}
 private pairTexture(index:number,holding=false){const base=(holding?'holding-art-':'pair-art-')+index,key=base+'-'+JSON.stringify(save.appearance)+'-'+save.hat+'-'+save.earphones+'-'+save.band;if(this.textures.exists(key))return key;const source=this.textures.get(base).getSourceImage() as HTMLCanvasElement,c=document.createElement('canvas');c.width=source.width;c.height=source.height;const g=c.getContext('2d')!;for(const [who,left,right]of [['girl',0,c.width*.53],['boy',c.width*.53,c.width]] as const){g.save();g.beginPath();g.rect(left,0,right-left,c.height);g.clip();g.drawImage(this.textures.get(this.appearanceKey(who,base)).getSourceImage() as HTMLCanvasElement,0,0);g.restore()}for(const who of ['girl','boy'] as const){if(save.appearance[who].hair===0)continue;const pose=index%4,front=holding?Math.floor(index/4):0,key=who+'-head-'+(save.appearance[who].hair*4+front);const head=this.textures.get(this.appearanceKey(who,'head-'+key)).getSourceImage() as HTMLCanvasElement;const x=c.width*(who==='girl'?(index<4&&pose>0?.34:.25):.74),h=c.height*(who==='girl'?.52:.49),w=h*head.width/head.height;g.drawImage(head,x-w/2,0,w,h)}if(save.hat){const hat=this.textures.get('gift-hat').getSourceImage() as HTMLCanvasElement;g.drawImage(hat,c.width*.1,-c.height*.015,c.width*.33,c.height*.2)}if(save.earphones){const ear=this.textures.get('gift-earphones').getSourceImage() as HTMLCanvasElement;g.drawImage(ear,c.width*.32,c.height*.19,c.width*.15,c.height*.19)}if(save.band){g.fillStyle='#e7a7c2';g.fillRect(c.width*.42,c.height*.65,Math.max(2,c.width*.025),Math.max(2,c.height*.025))}this.textures.addCanvas(key,c);return key}
 private updateAction(dt:number){if(!this.pairReady){this.buddy.update(this.boy,dt,this.walkable);return}this.actionTime+=dt;const kind=this.actionKind,duration=actions[kind]?.duration??2.5;const phase=this.actionTime/duration;const hug=['hug','head','shoulder','share','flower'].includes(kind);const frame=kind==='dance'||kind==='scare'?12+Math.floor(this.actionTime*7)%4:8+Math.min(3,Math.floor(phase*4));this.setPose(this.player,'girl','action',frame);this.setPose(this.boy,'boy','action',frame);if(hug&&phase>.12&&phase<.9&&this.pairImage){const group=kind==='head'?4:kind==='flower'||kind==='share'?8:0;const offset=kind==='share'?2+Math.min(1,Math.floor(phase*2)):kind==='flower'?Math.min(1,Math.floor(phase*2)):Math.min(3,Math.floor(phase*4));const key=this.pairTexture(group+offset);this.pairImage.setTexture(key).setPosition((this.player.x+this.boy.x)/2,Math.max(this.player.y,this.boy.y)).setVisible(true);const src=this.pairImage.texture.getSourceImage() as HTMLCanvasElement;this.pairImage.setDisplaySize(64*src.width/src.height,64);this.player.setVisible(false);this.boy.setVisible(false)}else{this.pairImage?.setVisible(false);this.player.setVisible(true);this.boy.setVisible(true)}if(hug&&phase>.2&&phase<.8){this.player.setAngle(-4);this.boy.setAngle(4)}if(this.actionTime>=duration){this.pairImage?.setVisible(false);this.player.setVisible(true);this.boy.setVisible(true);this.actionKind='';this.player.setAngle(0);this.boy.setAngle(0);this.actor.cancel();this.setPose(this.player,'girl','idle',0);this.setPose(this.boy,'boy','idle',0);this.syncFollowing()}}
 private environment(){const g=this.effects,t=save.reduced?0:this.idleTime;renderWindowWeather(g,this.zone,this.weather,this.daylight,t);const indoor=indoorZones.has(this.zone);if(this.daylight==='dawn'){g.fillStyle(0xffc58e,indoor?.035:.16);g.fillRect(0,0,640,427)}if(this.daylight==='day'){g.fillStyle(0xffefb1,indoor?.045:.23);g.fillRect(0,0,640,427)}if(this.weather!=='clear'&&!indoor){for(let i=0;i<65;i++){const x=(i*83+t*9)%640,y=(i*47+t*(this.weather==='rain'?120:18))%427;g.fillStyle(this.weather==='rain'?0xb7d7eb:0xfff6dd,.6);g.fillRect(x,y,this.weather==='rain'?1:2,this.weather==='rain'?7:2)}}}
 private releasePlane(){if(save.reduced)return;const plane=this.add.text(448,181,'➤',{fontFamily:'monospace',fontSize:'18px',color:'#fff2cd'}).setDepth(18).setAngle(-25);this.tweens.add({targets:plane,x:130,y:60,angle:-5,alpha:0,duration:3600,ease:'Sine.easeInOut',onComplete:()=>plane.destroy()})}
 private atmosphere(){
  const g=this.effects,t=save.reduced?0:this.idleTime;g.clear();
  if(this.zone==='aquarium'){
   const active=save.moments.includes('jellyfish');for(let i=0;i<(active?9:4);i++){const x=110+(i*69)%420+Math.sin(t*.4+i)*14,y=65+(i*31)%80+Math.sin(t*.6+i)*6;g.fillStyle(i%2?0xe9b8eb:0xa8e8e6,.24);g.fillEllipse(x,y,12,8);g.lineStyle(1,0xc3e6f0,.3);g.lineBetween(x-2,y+3,x-3+Math.sin(t+i)*3,y+14)}
  }else if(this.zone==='camp'){
   g.fillStyle(0xffbf70,.13);g.fillEllipse(400,156,85+Math.sin(t*3)*4,44);for(let i=0;i<6;i++){g.fillStyle(0xffd291,.65);g.fillRect(394+(i*7)%17+Math.sin(t+i)*3,156-(t*14+i*8)%36,1,2)}if(save.moments.includes('camp-lights'))for(let i=0;i<8;i++){const x=100+i*60,y=98+Math.sin(i*.5)*14;g.fillStyle(0xffdd88,.14);g.fillCircle(x,y,12);g.fillStyle(0xffebbd,.9);g.fillRect(x-1,y,3,4)}if(save.moments.includes('marshmallow')){g.fillStyle(0xffead2,.9);g.fillRect(387,160,5,5);g.fillRect(412,160,5,5)}
  }else if(this.zone==='room'){
   const lit=save.moments.includes('fireplace');g.fillStyle(0xffbc55,lit?.14:.07);g.fillEllipse(79,116,lit?100:70,42);
   if(save.moments.includes('flowers'))for(let i=0;i<4;i++){g.fillStyle(0xe5abc0,.55);g.fillRect(437+Math.sin(t*.4+i)*12,123+(t*3+i*9)%36,2,1)}
   if(save.moments.includes('tea'))for(let i=0;i<3;i++){const y=312-((t*6+i*8)%25);g.fillStyle(0xffeddb,.22);g.fillRect(195+Math.sin(t+i)*3,y,2,4)}
   for(const x of [280,292,304,318,332,346]){g.fillStyle(0xffe1a7,.45+Math.sin(t*5+x)*.2);g.fillEllipse(x,164+Math.sin(t*4+x)*1.5,2.5,5)}for(const x of [188,238,391]){g.fillStyle(0xffc77e,.07+(Math.sin(t*2+x)+1)*.025);g.fillCircle(x,105,25)}
  }else if(this.zone==='magic'){
   for(let i=0;i<16;i++){const x=130+(i*71)%390,y=75+(i*47)%120;g.fillStyle(i%2?0xeab7e7:0xafe6da,.4);g.fillRect(x+Math.sin(t*.8+i)*8,y+Math.cos(t+i)*5,2,2)}if(save.moments.includes('potion')){g.fillStyle(0xe7a0cb,.4);g.fillEllipse(391,236,16,22)}if(save.moments.includes('spell'))for(let i=0;i<12;i++){const a=i/12*Math.PI*2+t;g.fillStyle(0xffe8b4,.6);g.fillRect(389+Math.cos(a)*26,230+Math.sin(a)*17,2,2)}
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
 update(_time:number,delta:number){
  if(!this.player)return;this.walkingNow=false;this.frameView();const dt=Math.min(delta,40)/1000;this.idleTime+=dt;
  if(this.staging){this.actor.update(this.player,dt,this.walkable);this.buddy.update(this.boy,dt,this.walkable);if(!this.actor.moving&&!this.buddy.moving){this.staging=false;this.setPose(this.player,'girl','idle',2);this.setPose(this.boy,'boy','idle',2);this.syncFollowing();const done=this.stagingDone;this.stagingDone=undefined;done?.()}}
  if(this.seated)this.updateSeated(dt);else if(this.actionKind&&!this.blocked)this.updateAction(dt);
  if(!this.blocked&&this.entered&&!this.seated&&!this.actionKind){
   let dx=(this.keys.D.isDown||this.keys.RIGHT.isDown?1:0)-(this.keys.A.isDown||this.keys.LEFT.isDown?1:0)+this.joystick.x,dy=(this.keys.S.isDown||this.keys.DOWN.isDown?1:0)-(this.keys.W.isDown||this.keys.UP.isDown?1:0)+this.joystick.y;
   let moving=false;const old={x:this.player.x,y:this.player.y};
   if(Math.hypot(dx,dy)>.13){this.actor.cancel();this.path=[];this.pending=undefined;if(this.movingTo){this.movingTo=undefined;this.bridge.emit('approaching',undefined)}const d=Math.max(1,Math.hypot(dx,dy));dx/=d;dy/=d;moveWithCollision(this.player,dx*84*dt,dy*84*dt,this.walkable);moving=Math.hypot(this.player.x-old.x,this.player.y-old.y)>.001}
   else moving=this.actor.update(this.player,dt,this.walkable);
   if(moving){dx=this.player.x-old.x;dy=this.player.y-old.y;if(Math.abs(dx)+Math.abs(dy)>.05)this.dir=Math.abs(dx)>Math.abs(dy)?(dx<0?1:3):(dy<0?2:0);this.moveTime+=dt;this.player.setAngle(0)}
   else{this.player.setAngle(0);if(this.movingTo){this.face(this.movingTo);this.focusId=this.movingTo.id;this.movingTo=undefined;this.bridge.emit('approaching',undefined)}}
   this.walkingNow=moving;const phase=Math.floor(this.moveTime*8)%4;if(!this.seated)this.renderMoving(this.player,'girl',this.dir,moving,phase);
  }
  const oldBoy={x:this.boy.x,y:this.boy.y};
  if(this.boyPath.length&&!this.seated)this.advance(this.boy,this.boyPath,87*dt);
  else if(!this.seated&&!this.blocked&&!this.actionKind){const formed=this.holding&&this.handFormation.update(this.boy,this.player,dt,this.walkable);if(!formed)this.follower.update(this.boy,this.player,dt,this.walkable,Boolean(this.movingTo));}
  const boyDx=this.boy.x-oldBoy.x,boyDy=this.boy.y-oldBoy.y;
  if(!this.seated&&!this.actionKind&&Math.hypot(boyDx,boyDy)>.001)this.renderMoving(this.boy,'boy',(Math.abs(boyDx)>Math.abs(boyDy)?boyDx<0?1:3:boyDy<0?2:0),true,Math.floor(this.idleTime*8)%4);else if(!this.seated&&!this.actionKind)this.setPose(this.boy,'boy','idle',this.dir);
  if(this.seated==='swing'&&!save.reduced){const y=149+Math.sin(this.idleTime*2.5)*2;this.player.y=y;this.boy.y=y}
  if(!this.seated&&!this.actionKind){const joined=this.holding&&this.handFormation.active&&!this.blocked;if(joined&&this.pairImage){const key=this.pairTexture(this.dir*4+(this.walkingNow?Math.floor(this.moveTime*8)%4:0),true);this.pairImage.setTexture(key).setPosition((this.player.x+this.boy.x)/2,Math.max(this.player.y,this.boy.y)).setVisible(true).setDepth(10+Math.max(this.player.y,this.boy.y)/1000);const art=this.pairImage.texture.getSourceImage() as HTMLCanvasElement;this.pairImage.setDisplaySize(64*art.width/art.height,64)}else this.pairImage?.setVisible(false);this.player.setVisible(!joined);this.boy.setVisible(!joined)}
  this.shadow.setPosition(this.player.x,this.player.y-1);this.boyShadow.setPosition(this.boy.x,this.boy.y-1);this.hat.setPosition(this.player.x,this.player.y-this.player.displayHeight+3).setAngle(this.player.angle).setVisible(save.hat&&!this.pairImage?.visible);this.earwear?.setPosition(this.player.x+8,this.player.y-this.player.displayHeight+20).setVisible(save.earphones&&!this.pairImage?.visible);this.band.setPosition(this.player.x+(this.dir===1?-15:15),this.player.y-25).setVisible(save.band&&!this.pairImage?.visible);this.player.setDepth(this.seated?11:10+this.player.y/1000);this.boy.setDepth(this.seated?11:10+this.boy.y/1000);this.hat.setDepth(12);
  const npc=this.getItem('boy');if(npc){npc.x=this.boy.x;npc.y=this.boy.y-14;const options=[[-27,0],[27,0],[0,27],[0,-27]].map(([x,y])=>({x:this.boy.x+x,y:this.boy.y+y})).filter(p=>this.walkable(p)).sort((a,b)=>Math.hypot(a.x-this.player.x,a.y-this.player.y)-Math.hypot(b.x-this.player.x,b.y-this.player.y));const approach=options[0]??this.boy;npc.point=[approach.x,approach.y]}
  const candidates=this.objects.filter(item=>inReach(this.player,item,this.walkable)).sort((a,b)=>Math.hypot(a.point[0]-this.player.x,a.point[1]-this.player.y)-Math.hypot(b.point[0]-this.player.x,b.point[1]-this.player.y));
  const nearest=this.actionKind||(this.holding&&this.handFormation.active)||this.seated?undefined:candidates.find(item=>item.id===this.focusId)??candidates[0];
  if(nearest?.id!==this.nearby?.id){this.nearby=nearest;this.bridge.emit('nearby',nearest)}
  this.glow.clear();if(this.nearby&&!this.blocked&&!this.seated&&!this.movingTo){this.glow.lineStyle(1,0xffe3a5,.7);this.glow.strokeEllipse(this.nearby.x,this.nearby.y+5,26,10);this.bridge.emit('hint-position',this.project(this.nearby.x,this.nearby.y-20))}
  this.bridge.emit('portal-positions',this.objects.filter(i=>i.to).map(i=>({id:i.id,name:worlds[i.to!].name,...this.project(i.x,i.y)})));this.atmosphere();this.environment();this.motion?.update(this.idleTime);if(this.entered&&!this.blocked&&!this.seated&&!this.movingTo){const game=this.objects.find(i=>i.id.startsWith('game-')&&!this.autoGames.has(this.zone+':'+i.id)&&Math.hypot(i.point[0]-this.player.x,i.point[1]-this.player.y)<13);if(game){this.autoGames.add(this.zone+':'+game.id);this.stop();this.bridge.emit('interact',game.id)}}
  if(!this.blocked&&this.entered&&!this.seated&&this.zone==='room'&&this.player.y>=376&&Math.abs(this.player.x-320)<18){this.blocked=true;this.stop();this.bridge.emit('interact','door')}
 }
}

