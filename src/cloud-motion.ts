import type {CloudLayer} from '../content/cloud-layers.mjs';
import type {Cottage} from './scene';
import {preparedResource} from './release-resources';
import {save} from './state';

type LayerInstance={definition:CloudLayer;sprite:Phaser.GameObjects.Image;start:number;running:boolean;key:string};
export class CloudMotion{
 private clock=0;
 private instances:LayerInstance[]=[];
 private textures=new Set<string>();
 constructor(private scene:Cottage){}
 async prepare(layers:CloudLayer[]){
  const keys=new Map<string,string>();
  try{
   for(const definition of layers){
    const key='cloud-layer-'+crypto.randomUUID();
    const image=new Image();
    image.crossOrigin='anonymous';
    await new Promise<void>((resolve,reject)=>{
     const timer=setTimeout(()=>{image.src='';reject(Error('Layer timed out'))},12000);
     image.onload=()=>{clearTimeout(timer);resolve()};
     image.onerror=()=>{clearTimeout(timer);reject(Error('Layer unavailable'))};
     image.src=preparedResource(definition.src);
    });
    if(image.width>4096||image.height>4096)throw Error('Layer dimensions exceed limit');
    const frames=definition.frames;
    if(frames){
     if(image.width%frames.columns||image.height%frames.rows)throw Error('Sprite sheet dimensions must divide into cells');
     this.scene.textures.addSpriteSheet(key,image,{frameWidth:image.width/frames.columns,frameHeight:image.height/frames.rows});
    }else this.scene.textures.addImage(key,image);
    keys.set(definition.id,key);
   }
   return keys;
  }catch(error){for(const key of keys.values())this.scene.textures.remove(key);throw error}
 }
 mount(layers:CloudLayer[],keys:Map<string,string>){
  this.clear();
  this.textures=new Set(keys.values());
  this.instances=layers.map(definition=>{
   const key=keys.get(definition.id)!;
   const sprite=this.scene.add.image(definition.x,definition.y,key).setDisplaySize(definition.width,definition.height).setDepth(definition.depth);
   return {definition,sprite,start:this.clock,running:definition.autoplay,key};
  });
 }
 trigger(id:string){
  for(const layer of this.instances)if(layer.definition.trigger===id){layer.start=this.clock;layer.running=true}
 }
 update(milliseconds:number){
  this.clock+=Math.min(milliseconds,100);
  for(const layer of this.instances){
   const {definition,sprite}=layer;
   if(!layer.running)continue;
   const elapsed=save.reduced?0:(this.clock-layer.start)/1000;
   if(definition.frames){
    const {columns,rows,fps,loop}=definition.frames;
    const count=columns*rows,index=Math.floor(elapsed*fps);
    sprite.setFrame(loop?index%count:Math.min(count-1,index));
    if(!loop&&index>=count&&!definition.path)layer.running=false;
   }
   if(definition.path){
    const {points,seconds}=definition.path;
    const loop=definition.frames?.loop??true;
    const phase=(loop?elapsed%seconds:Math.min(elapsed,seconds))/seconds*(points.length-1);
    const index=Math.min(points.length-2,Math.floor(phase)),fraction=phase-index;
    const from=points[index],to=points[index+1];
    sprite.setPosition(from[0]+(to[0]-from[0])*fraction,from[1]+(to[1]-from[1])*fraction);
    if(!loop&&elapsed>=seconds)layer.running=false;
   }
  }
 }
 clear(){
  for(const layer of this.instances)layer.sprite.destroy();
  this.instances=[];
  for(const key of this.textures)this.scene.textures.remove(key);
  this.textures.clear();
 }
 discard(keys:Map<string,string>){for(const key of keys.values())this.scene.textures.remove(key)}
}
