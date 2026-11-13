import type Phaser from 'phaser';
import type {Cottage} from './scene';
import type {PlayerState} from './online-protocol';
import {assetUrl} from './assets';
import {save} from './state';
export function visiblePets(players:PlayerState[],zone:string){return players.filter(p=>p.connected&&p.position.zone===zone&&p.pet?.enabled&&['firefly','star','cat'].includes(p.pet.kind))}
export function petTarget(actor:{x:number;y:number},role:string,t:number,reduced:boolean){return{x:actor.x+(role==='host'?-24:24),y:actor.y-38+(reduced?0:Math.sin(t*2.5)*3)}}
/** Pet positions are independent visual followers; they never control an actor. */
export class OnlinePets{
 private pets=new Map<string,{kind:string;image:Phaser.GameObjects.Sprite;joy:number;text?:Phaser.GameObjects.Text}>();
 private pending=new Set<string>();private failed=new Set<string>();private time=0;
 constructor(private scene:Cottage){scene.bridge.on('retry-pets',()=>this.failed.clear())}
 update(dt:number){
  this.time+=dt;const net=this.scene.onlineWorld;
  const wanted=net?.active?visiblePets((net.snapshot?.players??[]).map(p=>p.id===net.playerId?{...p,position:{...p.position,zone:this.scene.zone}}:p.id===net.remote?.id?net.remote:p),this.scene.zone):[];
  for(const [id,pet]of this.pets)if(!wanted.some(p=>p.id===id&&p.pet.kind===pet.kind)){pet.image.destroy();pet.text?.destroy();this.pets.delete(id)}
  for(const player of wanted){const key='online-pet-'+player.pet.kind;if(!this.scene.textures.exists(key)){if(!this.pending.has(key)&&!this.failed.has(key))void this.load(player.pet.kind);continue}
   const actor=player.role==='host'?this.scene.player:this.scene.boy,target=petTarget(actor,player.role,this.time,save.reduced);let pet=this.pets.get(player.id);
   if(!pet){const image=this.scene.add.sprite(target.x,target.y,key,0).setDisplaySize(25,25).setDepth(14).setInteractive({useHandCursor:true});pet={kind:player.pet.kind,image,joy:0};this.pets.set(player.id,pet);image.on('pointerdown',(_p:unknown,_x:number,_y:number,event:{stopPropagation():void})=>{event?.stopPropagation();const p=this.pets.get(player.id);if(!p)return;p.joy=1.4;p.text?.destroy();p.text=this.scene.add.text(image.x,image.y-20,(player.pet.name||'小精灵')+' 喜欢你',{fontFamily:'CottagePixel',fontSize:'12px',color:'#fff2c6',backgroundColor:'#49344c',padding:{x:5,y:4}}).setOrigin(.5,1).setDepth(30)})}
   pet.joy=Math.max(0,pet.joy-dt);const blend=save.reduced?1:Math.min(1,dt*6);pet.image.setPosition(pet.image.x+(target.x-pet.image.x)*blend,pet.image.y+(target.y-pet.image.y)*blend).setFrame(save.reduced?0:pet.joy>0?4:Math.floor(this.time*7)%6).setVisible(actor.visible&&!this.scene.transitioning);
   if(pet.text){pet.text.setPosition(pet.image.x,pet.image.y-20);if(!pet.joy){pet.text.destroy();pet.text=undefined}}
  }
 }
 private async load(kind:string){const key='online-pet-'+kind;this.pending.add(key);this.scene.bridge.emit('pet-loading',kind);
  try{const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=assetUrl('pet-'+kind+'.webp')});if(!this.scene.textures.exists(key))this.scene.textures.addSpriteSheet(key,image,{frameWidth:96,frameHeight:96});this.scene.bridge.emit('pet-ready',kind)}catch{this.failed.add(key);this.scene.bridge.emit('pet-error',kind)}finally{this.pending.delete(key)}
 }
 dispose(){for(const pet of this.pets.values()){pet.image.destroy();pet.text?.destroy()}this.pets.clear()}
}
