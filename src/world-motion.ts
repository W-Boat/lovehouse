import Phaser from 'phaser';
import {SchoolMotion} from './school-motion';
import {RoomCat} from './room-cat';
import type {Cottage} from './scene';
import {save} from './state';
export class WorldMotion{
 private school?:SchoolMotion;
 private roomCat?:RoomCat;
 private cat?:Phaser.GameObjects.Image;
 private catAction='';
 private catUntil=0;
 private clock=0;
 private objects:Phaser.GameObjects.GameObject[]=[];private images:Phaser.GameObjects.Image[]=[];private sun?:Phaser.GameObjects.Arc;
 constructor(private scene:Cottage){}
 destroy(){this.school?.destroy();this.school=undefined;this.roomCat?.destroy();this.roomCat=undefined;this.objects.forEach(o=>o.destroy());this.objects=[];this.images=[];this.sun=undefined;this.cat=undefined;this.catAction='';this.catUntil=0}
 rebuild(){const catPoint=this.scene.zone==='room'?this.roomCat?.position:undefined;this.destroy();const s=this.scene,z=s.zone;const image=(x:number,y:number,key:string,w:number,h:number,depth=2)=>{const i=s.add.image(x,y,key).setDisplaySize(w,h).setDepth(depth);this.objects.push(i);this.images.push(i);return i};
 if(z==='highschool')this.school=new SchoolMotion(s);
 if(z==='room'&&s.textures.exists('cottage-cat-0'))this.roomCat=new RoomCat(s,catPoint);
 if(z==='catcottage')this.cat=image(335,213,'cottage-cat-0',45,45,10.22).setOrigin(.5,1);
 if(z==='station'){this.sun=s.add.circle(230,75,15,0xffdf9d,.8).setDepth(1);this.objects.push(this.sun);image(480,122,'train-0',190,72,1)}
 if(z==='aquarium'){for(let i=0;i<4;i++)image(160+i*105,90+i%2*40,'jelly-0',36,47,1);for(let i=0;i<5;i++)image(120+i*90,125,'fish-0',24,16,1)}
 if(z==='ferris'){image(320,78,'motion-wheel',300,300,1);for(let i=0;i<8;i++)image(320,78,'motion-cabin',33,38,2)}
 if(z==='room'){image(77,106,'flame-0',21,24,2);for(const x of [309,320,331])image(x,159,'flame-0',3,7,4)}
 if(z==='camp')image(400,149,'flame-0',44,40,2);
 if(z==='haunted')image(428,130,'motion-ghost',32,40,3);
 if(z==='magic')for(let i=0;i<3;i++)image(226+i*80,98+i%2*30,'motion-book',30,24,3);
 }
 interact(id:string){
  if(id.startsWith('school-')){this.school?.interact(id);return}
  if(id.startsWith('room-cat-')){this.roomCat?.interact(id);return}
  if(!this.cat||!['cat-pet','cat-play','cat-feed'].includes(id))return;
  this.catAction=id;
  this.catUntil=this.clock+4;
 }
 update(clock:number){this.roomCat?.update(clock);this.school?.update(clock);this.clock=clock;const t=save.reduced?0:clock,s=this.scene,z=s.zone;if(z==='station'){const p=t%44,train=this.images[0];const x=p<8?780-(p/8)*300:p<26?480:480-(p-26)/18*750;train?.setX(x).setTexture('train-'+(p>10&&p<23?2:p>8&&p<26?1:0));this.sun?.setY(s.calendarState.enabled?110-45*s.calendarState.daylight:110-45*(.5-.5*Math.cos(t/50))).setAlpha(s.calendarState.enabled?(s.calendarState.period==='night'?0:.7):.65+Math.sin(t/40)*.12)}
 else if(z==='catcottage'&&this.cat){
  const acting=clock<this.catUntil;
  const progress=acting?Math.min(1,(4-(this.catUntil-clock))/.8):0;
  const play=acting&&this.catAction==='cat-play',feed=acting&&this.catAction==='cat-feed';
  const travel=play?149:feed?105:0;
  const settle=acting?Math.min(progress,(this.catUntil-clock)/.8):0;
  const bounce=play&&!save.reduced?Math.abs(Math.sin(t*8))*7:0;
  this.cat.setPosition(335+travel*settle,213+(play?67:feed?27:0)*settle-bounce)
   .setTexture('cottage-cat-'+(save.reduced?0:acting&&this.catAction==='cat-pet'?4:Math.floor(t*(play?10:4))%6))
   .setDepth(10.001+this.cat.y/1000);
 }
 else if(z==='aquarium'){this.images.forEach((o,i)=>{if(i<4)o.setPosition(160+i*105+Math.sin(t*.3+i)*22,85+i%2*40+Math.sin(t*.8+i)*9).setTexture('jelly-'+Math.floor(t*5+i)%4);else{const k=i-4;o.setPosition(100+(k*97+t*(12+k*2))%440,110+k%3*20+Math.sin(t+k)*4).setTexture('fish-'+Math.floor(t*6+k)%4)}})}
 else if(z==='ferris'){this.images[0]?.setRotation(t/40);for(let i=1;i<this.images.length;i++){const a=t/40+(i-1)*Math.PI/4;this.images[i].setPosition(320+Math.cos(a)*142,78+Math.sin(a)*142)}}
 else if(z==='room'||z==='camp')this.images.forEach((o,i)=>{o.setTexture('flame-'+Math.floor(t*8+i)%4);if(z==='room'&&i>0)o.setVisible(!save.celebrated)});
 else if(z==='haunted')this.images[0]?.setY(130+Math.sin(t)*7).setAngle(Math.sin(t*.8)*5);
 else if(z==='magic')this.images.forEach((o,i)=>o.setY(98+i%2*30+Math.sin(t+i)*6).setAngle(Math.sin(t*.8+i)*6));
 }
}
