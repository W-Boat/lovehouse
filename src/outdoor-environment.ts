import type Phaser from 'phaser';
import type {Cottage} from './scene';
import type {Season} from './calendar';
import {assetUrl} from './assets';

export const seasonalZones=['garden','forest','pier','station','postoffice','camp','ferris','market','mars'] as const;
export function seasonalFiles(zone:string,season:Season){
 if(!(seasonalZones as readonly string[]).includes(zone))return;
 return ['night','day'].map(period=>`seasons/${zone}-${season}-${period}.webp`) as [string,string];
}
/** Background-only layers: climate never writes actor positions or collision data. */
export class OutdoorEnvironment{
 private night:Phaser.GameObjects.Image;
 private day:Phaser.GameObjects.Image;
 private loaded=new Map<string,[string,string]>();
 private requested='';private displayed='';private loading=false;private failures=new Set<string>();
 constructor(private scene:Cottage){
  scene.bridge.on('retry-climate',()=>this.retry());
  this.night=scene.add.image(0,0,'room').setOrigin(0).setDisplaySize(640,426.667).setDepth(.02).setVisible(false);
  this.day=scene.add.image(0,0,'room').setOrigin(0).setDisplaySize(640,426.667).setDepth(.03).setVisible(false);
 }
 update(){
  const snap=this.scene.calendarState,files=seasonalFiles(this.scene.zone,snap.season);
  const request=snap.enabled&&files?`${this.scene.zone}:${snap.season}`:'';
  this.requested=request;
  if(!request){this.night.setVisible(false);this.day.setVisible(false);this.displayed='';return}
  const pair=this.loaded.get(request);
  if(pair){
   if(this.displayed!==request){this.night.setTexture(pair[0]);this.day.setTexture(pair[1]);this.displayed=request;this.loaded.delete(request);this.loaded.set(request,pair)}
   this.night.setVisible(true).setAlpha(1);this.day.setVisible(true).setAlpha(snap.daylight);
  }else{
   // Retain this zone's last season while loading; never show another zone.
   const sameZone=this.displayed.split(':')[0]===this.scene.zone;
   this.night.setVisible(sameZone);this.day.setVisible(sameZone);
  }
  if(!pair&&!this.loading&&!this.failures.has(request))void this.load(request,files!);
 }
 private async load(request:string,files:[string,string]){
  this.loading=true;const keys=files.map(file=>'seasonal:'+file) as [string,string];
  try{
   const results=await Promise.allSettled(keys.map((key,i)=>this.ensure(key,files[i])));
   if(results.some(result=>result.status==='rejected'))throw new Error(request);
   this.loaded.set(request,keys);
   // Three climate pairs at most. In-use textures survive late responses.
   for(const [id,pair]of this.loaded){if(this.loaded.size<=3)break;if(id===this.displayed||id===this.requested)continue;this.loaded.delete(id);for(const key of pair)this.scene.textures.remove(key)}
  }catch{
   this.failures.add(request);for(const key of keys)if(this.scene.textures.exists(key))this.scene.textures.remove(key);
   this.scene.bridge.emit('climate-asset-error',request);
  }finally{this.loading=false}
 }
 private ensure(key:string,file:string){
  if(this.scene.textures.exists(key))return Promise.resolve();
  return new Promise<void>((resolve,reject)=>{
   const image=new Image();image.onload=()=>{if(!this.scene.textures.exists(key))this.scene.textures.addImage(key,image);resolve()};
   image.onerror=()=>reject(new Error(file));image.src=assetUrl(file);
  });
 }
 retry(){this.failures.clear()}
 drawTo(context:CanvasRenderingContext2D,x:number,y:number,width:number,height:number){
  if(!this.night.visible||!this.day.visible)return false;
  context.save();context.globalAlpha=1;
  context.drawImage(this.night.texture.getSourceImage() as HTMLImageElement,x,y,width,height);
  context.globalAlpha=this.day.alpha;context.drawImage(this.day.texture.getSourceImage() as HTMLImageElement,x,y,width,height);
  context.restore();return true;
 }
}
