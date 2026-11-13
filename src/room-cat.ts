import type Phaser from 'phaser';
import type {Cottage} from './scene';
import {ActorController} from './actors';
import {nearestWalkable} from './navigation';
import {save,persist} from './state';

/** A floor-bound house pet. It follows legal routes rather than chasing by teleport. */
export class RoomCat{
 private image:Phaser.GameObjects.Image;
 private mat:Phaser.GameObjects.Graphics;
 private controller=new ActorController();
 private clock=0;private last=0;private plan=0;private action='';private until=0;
 private home={x:445,y:335};
 get position(){return {x:this.image.x,y:this.image.y}}
 constructor(private scene:Cottage,position?:{x:number;y:number}){
  this.mat=scene.add.graphics().setDepth(3);
  this.mat.fillStyle(0x936f73,.85).fillEllipse(445,337,37,15);
  this.mat.lineStyle(1,0xdab7ad,.9).strokeEllipse(445,337,32,11);
  this.mat.fillStyle(0x99b7b5).fillEllipse(464,337,15,7);
  this.mat.fillStyle(0x59423c).fillEllipse(464,335,10,4);
  this.mat.fillStyle(0xb98654).fillCircle(462,334,1).fillCircle(465,335,1);
  this.mat.fillStyle(0xc58a9f).fillCircle(417,334,4);
  this.mat.lineStyle(1,0xefc2cd).lineBetween(414,332,420,335);
  const initial=position&&scene.walkable(position)?position:this.home;
  this.image=scene.add.image(initial.x,initial.y,'cottage-cat-0').setOrigin(.5,1).setDisplaySize(31,31).setDepth(10.335).setInteractive({useHandCursor:true});
  this.image.on('pointerdown',(_p:unknown,_x:number,_y:number,event:{stopPropagation():void})=>{event.stopPropagation();scene.approachById('room-cat-pet')});
 }
 interact(id:string){
  if(!id.startsWith('room-cat-'))return;
  this.controller.cancel();this.action=id;this.until=this.clock+4;
  if(id==='room-cat-follow'){
   save.notes['room-cat-follow']=save.notes['room-cat-follow']==='yes'?'no':'yes';persist();
   this.until=this.clock;this.plan=0;
   if(save.notes['room-cat-follow']!=='yes')this.controller.move(this.image,this.home,this.scene.walkable);
  }else if(id==='room-cat-feed')this.controller.move(this.image,{x:459,y:338},this.scene.walkable);
  else if(id==='room-cat-play')this.controller.move(this.image,{x:417,y:334},this.scene.walkable);
 }
 update(clock:number){
  const dt=Math.max(0,Math.min(.25,clock-this.last));this.last=clock;this.clock=clock;
  const acting=clock<this.until,player=this.scene.controlledActor;
  const approaching=this.scene.movingTo?.id.startsWith('room-cat-');
  if(approaching)this.controller.cancel();
  if(!acting&&!approaching&&clock>=this.plan){
   this.plan=clock+.7;
   const following=save.notes['room-cat-follow']==='yes'&&!this.scene.seated;
   const target=following?nearestWalkable({x:player.x+24,y:player.y+12},this.scene.walkable,60):this.home;
   if(target&&Math.hypot(target.x-this.image.x,target.y-this.image.y)>(following?36:5))this.controller.move(this.image,target,this.scene.walkable);
  }
  const oldX=this.image.x,moving=this.controller.update(this.image,dt,this.scene.walkable,58);
  this.image.setFlipX(moving?this.image.x<oldX:this.image.x>player.x);
  const frame=save.reduced?0:acting&&this.action==='room-cat-pet'?4:moving||acting?Math.floor(clock*7)%6:Math.floor(clock*.8)%2;
  this.image.setTexture('cottage-cat-'+frame).setDepth(10+this.image.y/1000+.002);
  const item=this.scene.getItem('room-cat-pet');
  if(item){item.x=this.image.x;item.y=this.image.y-12;const point=nearestWalkable({x:this.image.x-18,y:this.image.y+12},this.scene.walkable,40);if(point)item.point=[point.x,point.y]}
 }
 destroy(){this.controller.cancel();this.image.destroy();this.mat.destroy()}
}
