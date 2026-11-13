import type Phaser from 'phaser';
import type {Cottage} from './scene';
import {worlds} from './world';
import {save} from './state';
export class SchoolMotion{
 private ink:Phaser.GameObjects.Graphics;
 private sign:Phaser.GameObjects.Text;
 private event='';private start=0;private clock=0;private from={x:320,y:300};
 constructor(private scene:Cottage){
  this.ink=scene.add.graphics().setDepth(12);
  this.sign=scene.add.text(320,142,worlds.highschool.name,{fontFamily:'CottagePixel',fontSize:'12px',color:'#674a36',letterSpacing:3}).setOrigin(.5).setDepth(2);
 }
 interact(id:string){this.event=id;this.start=this.clock;const p=this.scene.controlledActor;this.from={x:p.x,y:p.y-35}}
 update(clock:number){
  this.clock=clock;const g=this.ink;g.clear();const t=clock-this.start;
  if(!save.reduced){for(let i=0;i<5;i++){const x=90+(i*103+clock*9)%490,y=245+(clock*8+i*17)%100;g.fillStyle(i%2?0xeac072:0xdba15a,.55);g.fillEllipse(x,y,4,2)}}
  if(this.event==='school-basketball'&&t<3.2){
   const p=save.reduced?1:Math.min(1,t/1.3),target={x:608,y:173};
   const x=this.from.x+(target.x-this.from.x)*p;
   const y=this.from.y+(target.y-this.from.y)*p-Math.sin(p*Math.PI)*80+Math.max(0,t-1.3)*40;
   g.fillStyle(0xd68343).fillCircle(x,y,6);g.lineStyle(1,0x6f4431).strokeCircle(x,y,6);g.lineBetween(x-6,y,x+6,y);g.lineBetween(x,y-6,x,y+6);
  }
  if(this.event==='school-plane'&&t<6){const p=save.reduced ? .5 :Math.min(1,t/6),x=this.from.x+Math.sin(p*4)*110,y=this.from.y-p*160;g.fillStyle(0xfff2cd).fillTriangle(x-9,y+3,x+10,y-6,x+3,y+8);g.lineStyle(1,0xc7ac83).lineBetween(x-9,y+3,x+3,y+2)}
  if(['school-bell','school-radio'].includes(this.event)&&t<3){const item=this.scene.getItem(this.event);if(item)for(let i=0;i<3;i++){g.lineStyle(1,0xffdf9b,Math.max(0,1-(t+i*.4)%2/2));g.strokeCircle(item.x,item.y,8+(t*12+i*9)%30)}}
 }
 destroy(){this.ink.destroy();this.sign.destroy()}
}
