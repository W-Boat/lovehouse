import type Phaser from 'phaser';
import type {Cottage} from './scene';
import {save} from './state';
import type {Zone} from './world';
export type EffectKind='fire'|'lamp'|'tea'|'book'|'flower'|'chime'|'wave'|'fountain'|'flies'|'stars'|'bottle'|'seed'|'water'|'photo'|'bell'|'stamp'|'drip'|'jelly'|'echo'|'toast'|'potion'|'rune'|'chess'|'box'|'projector'|'popcorn'|'candle'|'stick'|'towel'|'ripple'|'wish'|'cloud'|'vent';
export const effectFrames=['effect-book','effect-bottle','effect-water','effect-photo','effect-bell','effect-stamp','effect-toast','effect-potion','effect-chess','effect-box','effect-popcorn','effect-candle','effect-towel','effect-vent','effect-teapot','effect-cups'];
const illustratedEffects=new Set<EffectKind>(['book','bottle','water','photo','bell','stamp','toast','potion','chess','box','popcorn','candle','towel','vent']);
export const placeEvents:Partial<Record<Zone,Record<string,EffectKind>>>={
 shichahai:{'shichahai-tea':'tea','shichahai-bridge':'wave','shichahai-lantern':'lamp'},gulou:{'gulou-drum':'bell','gulou-postcard':'photo','gulou-tea':'tea'},chaya:{'chaya-scope':'stars','chaya-rock':'wish','chaya-tea':'tea'},tianmo:{'tianmo-boat':'wave','tianmo-tea':'tea'},tanghulu:{'sugar-heat':'fire','sugar-cool':'chime'},
 room:{fireplace:'fire','room-lights':'lamp',tea:'tea',books:'book',flowers:'flower',candles:'candle',cabinet:'box'},garden:{chime:'chime',shell:'wave'},forest:{fountain:'fountain',fireflies:'flies',lanterns:'lamp'},pier:{telescope:'stars',bottle:'bottle',tide:'wave'},greenhouse:{seed:'seed','greenhouse-water':'water','greenhouse-vent':'vent'},memory:{'memory-photos':'photo','memory-books':'book','memory-lamp':'lamp','memory-tea':'tea'},station:{'station-bell':'bell',clouds:'cloud'},postoffice:{postmark:'stamp','rain-awning':'drip'},aquarium:{jellyfish:'jelly','ocean-echo':'echo'},camp:{marshmallow:'toast','camp-lights':'lamp'},magic:{potion:'potion',spell:'rune'},haunted:{'ghost-chess':'chess','ghost-box':'box',portrait:'photo'},cinema:{projector:'projector',popcorn:'popcorn','cinema-lamp':'lamp'},ferris:{'ferris-lights':'lamp','ferris-wish':'wish'},mars:{lightstick:'stick','mars-dance':'rune'},hotspring:{'spring-petals':'ripple','spring-towel':'towel','spring-tea':'tea'},market:{'market-flower':'flower','market-cake':'candle','market-bread':'toast'},aurora:{'aurora-fire':'fire','aurora-wish':'wish','aurora-tea':'tea'}};
/** Repeated interactions replay a concrete object operation, not an indefinite particle flag. */
export class PlaceEffects{
 private artRequest?:Promise<void>;private props=new Map<string,Phaser.GameObjects.Image>();
 private ink:Phaser.GameObjects.Graphics;private active=new Map<string,{kind:EffectKind;x:number;y:number;age:number}>();private zone:Zone;private toggled=new Map<string,boolean>();
 constructor(private scene:Cottage){this.zone=scene.zone;this.ink=scene.add.graphics().setDepth(8.6)}
 rebuild(){for(const prop of this.props.values())prop.destroy();this.props.clear();this.active.clear();this.ink.clear();this.zone=this.scene.zone}
 trigger(id:string){const kind=placeEvents[this.scene.zone]?.[id],item=this.scene.getItem(id);if(!kind||!item)return false;
  if(this.zone!==this.scene.zone)this.rebuild();if(illustratedEffects.has(kind)&&this.scene.prepareInteractionArt&&!this.artRequest)this.artRequest=this.scene.prepareInteractionArt().catch(()=>{this.artRequest=undefined});this.toggled.set(this.zone+':'+id,!this.toggled.get(this.zone+':'+id));
  let {x,y}=item;
  const camera=this.scene.cameras?.main,view=camera?.worldView;
  if(illustratedEffects.has(kind)&&view){
   x=Math.max(view.left+28,Math.min(view.right-28,x));
   y=Math.max(view.top+52+96/camera.zoom,Math.min(view.bottom-12,y));
  }
  this.active.set(id,{kind,x,y,age:0});return true;
 }
 update(delta:number){if(this.zone!==this.scene.zone)this.rebuild();const g=this.ink;g.clear();for(const [id,e]of this.active){e.age+=Math.max(0,Math.min(delta,100))/1000;if(e.age>7){this.active.delete(id);this.props.get(id)?.destroy();this.props.delete(id);continue}const t=save.reduced?2:e.age,p=Math.min(1,t/2),x=e.x,y=e.y,alpha=Math.min(1,(7-e.age)/1.2);g.setAlpha(alpha);
 if(illustratedEffects.has(e.kind)&&this.scene.textures?.exists('effect-'+e.kind)){
  let prop=this.props.get(id);
  if(!prop){
   const key='effect-'+e.kind,source=this.scene.textures.get(key).getSourceImage();
   const scale=52/Math.max(source.width,source.height);
   prop=this.scene.add.image(x,y,key).setOrigin(.5,1).setDisplaySize(source.width*scale,source.height*scale).setDepth(8.5);
   this.props.set(id,prop);
  }
  const turn=save.reduced?0:e.kind==='water'?-18*Math.sin(Math.min(1,t/3)*Math.PI):e.kind==='bell'?Math.sin(t*4)*9:e.kind==='book'?Math.sin(t*2)*3:0;
  prop.setPosition(x,y+10-(save.reduced?0:Math.sin(Math.min(1,t/3)*Math.PI)*5)).setAngle(turn).setAlpha(alpha);
 }
 const line=(a:number,b:number,c:number,d:number,color=0xf4dbb4,w=2)=>{g.lineStyle(w,color,1);g.lineBetween(a,b,c,d)};
 const box=(a:number,b:number,w:number,h:number,color:number)=>{g.fillStyle(color,1);g.fillRect(a,b,w,h)};
 const ring=(a:number,b:number,r:number,color=0xc2e8e5)=>{g.lineStyle(1,color,.65);g.strokeEllipse(a,b,r*2,r*.6)};
 switch(e.kind){
 case 'fire':box(x-10+10*p,y+8,18,4,0x724329);for(let i=0;i<4;i++){g.fillStyle(i%2?0xffbc61:0xffe0a1,.65);g.fillTriangle(x-12+i*7,y+9,x-5+i*7,y-8-8*Math.sin(t*5+i)**2,x+1+i*7,y+9)}break;
 case 'lamp':{const on=this.toggled.get(this.zone+':'+id);g.fillStyle(0xffdc94,on?.2:.035);g.fillCircle(x,y,30);if(on)for(let i=0;i<5;i++){g.fillStyle(0xffe4ac,.8);g.fillCircle(x-30+i*15,y+Math.sin(i)*4,2)}break}
 case 'tea':{
  // The scene already contains the illustrated tea set. Keep the cups visible.
  for(let i=0;i<2;i++){
   const cupX=x-6+i*12;
   for(let segment=0;segment<3;segment++){
    const rise=(t*5+segment*5)%17;
    const sway=save.reduced?0:Math.sin(t*2+i+segment)*1.5;
    line(cupX+sway,y-9-rise,cupX+sway+1,y-12-rise,0xf7e9d7,1);
   }
  }
  if(t<1.6){const pour=Math.sin(Math.min(1,t/1.6)*Math.PI);if(pour>.15)line(x-4,y-17,x+6,y-9,0xc6a274,1)}
  break;
 }
 case 'book':for(let i=0;i<3;i++)line(x-12,y-17+i*4,x+8+Math.sin(t)*3,y-17+i*4,0xf0cfa2,1);break;
 case 'flower':for(let i=0;i<5;i++){const a=i*1.25;g.fillStyle(i%2?0xf7b9c4:0xffdba8,1);g.fillCircle(x+Math.cos(a)*8,y-5+Math.sin(a)*8,5)}line(x,y,x+Math.sin(t)*3,y+22,0x749b62);break;
 case 'chime':line(x,y-20,x+Math.sin(t*5)*9*(1-p*.8),y,0xbca16b);g.fillStyle(0xffd79f,.8);g.fillEllipse(x+Math.sin(t*5)*9*(1-p*.8),y,10,13);break;
 case 'wave':case 'echo':case 'fountain':case 'ripple':for(let i=0;i<3;i++)ring(x,y,5+(t*10+i*9)%33);if(e.kind==='fountain')for(let i=0;i<5;i++)line(x,y,x-15+i*7,y-20+Math.abs(i-2)*5,0xb5e1ea,1);break;
 case 'flies':for(let i=0;i<9;i++){const a=i*2+t;g.fillStyle(0xe5f69b,.7);g.fillCircle(x+Math.cos(a)*18*(1-p*.65),y-10+Math.sin(a*.7)*15,1.5)}break;
 case 'stars':for(let i=0;i<7;i++){const a=i*2.3;box(x+Math.cos(a)*18,y+Math.sin(a)*18,2,2,0xffefb5)}line(x-14,y+14,x+16,y-14,0x9ab8d4,1);break;
 case 'bottle':for(let i=0;i<3;i++)ring(x-5+i*5,y-12-(t*6+i*7)%23,2);break;
 case 'seed':box(x-15,y+8,30,8,0x785135);line(x,y+8,x,y+8-26*p,0x82b568,3);g.fillStyle(0x9bd279,1);g.fillEllipse(x-6*p,y-10*p,12*p,5);g.fillEllipse(x+6*p,y-15*p,12*p,5);break;
 case 'water':for(let i=0;i<6;i++)line(x-13+i%3*3,y-10+(t*15+i*6)%23,x-12+i%3*3,y-7+(t*15+i*6)%23,0xb4e5f1,1);break;
 case 'photo':for(let i=0;i<3;i++){const px=x-17+i*16,py=y-22-i%2*7;line(px-2,py,px+2,py,0xffdf9e,1);line(px,py-2,px,py+2,0xffdf9e,1)}break;
 case 'bell':if(t<3){g.lineStyle(1,0xe1bb77,.6);g.strokeCircle(x,y-20,8+(t*5)%15)}break;
 case 'stamp':g.lineStyle(1,0x9c5865,1);g.strokeCircle(x+10,y-10,5);line(x+7,y-10,x+13,y-10,0x9c5865,1);break;
 case 'drip':for(let i=0;i<5;i++){const yy=y+(t*20+i*8)%35;box(x-23+i*11,yy,1,4,0xafd2df);ring(x-23+i*11,y+36,3+(t*6+i)%8)}break;
 case 'jelly':g.fillStyle(0xc79ae5,.6);g.fillEllipse(x+Math.sin(t)*12,y-8,28,19);for(let i=0;i<4;i++)line(x-9+i*6+Math.sin(t)*12,y,x-9+i*6+Math.sin(t+i)*4,y+14,0xe7bfe9,1);break;
 case 'toast':for(let i=0;i<3;i++)line(x-3+i*3,y-28-(t*5+i*5)%15,x-2+i*3,y-31-(t*5+i*5)%15,0xffe6c1,1);break;
 case 'potion':for(let i=0;i<3;i++)ring(x-7+i*7,y-30-(t*8+i*9)%20,2,0xe8a7d6);break;
 case 'rune':g.lineStyle(2,0xd5b4ec,.8);g.strokeCircle(x,y,23);for(let i=0;i<5;i++){const a=i*Math.PI*.8;line(x+Math.cos(a)*19,y+Math.sin(a)*19,x+Math.cos(a+Math.PI*.8)*19,y+Math.sin(a+Math.PI*.8)*19,0xf3d0df,1)}break;
 case 'chess':g.lineStyle(1,0xe1b2cf,.8);g.strokeCircle(x-15+20*p,y-14+6*p,4);break;
 case 'box':for(let i=0;i<4;i++){const px=x-15+i*10,py=y-32-Math.sin(t+i)*4;line(px-2,py,px+2,py,0xffd594,1);line(px,py-2,px,py+2,0xffd594,1)}break;
 case 'projector':g.fillStyle(0xf7e6b2,.13);g.fillTriangle(x,y,x-180,y-65,x-180,y+60);g.lineStyle(2,0xd9c5a1,1);g.strokeCircle(x,y-9,9);g.strokeCircle(x+17,y-9,9);for(let i=0;i<3;i++){const a=t*2+i*2;line(x,y-9,x+Math.cos(a)*8,y-9+Math.sin(a)*8,0x665e62,1)}break;
 case 'popcorn':for(let i=0;i<3;i++){g.fillStyle(0xffe7ad,.85);g.fillCircle(x-7+i*7,y-42-Math.sin(t*2+i)**2*6,2)}break;
 case 'candle':g.fillStyle(0xffce78,.2);g.fillCircle(x,y-34,10+(save.reduced?0:Math.sin(t*4)));break;
 case 'stick':line(x,y+18,x-6*Math.sin(t*2),y-16,0xf5a5cf,5);g.fillStyle(0xf8b6da,.16);g.fillCircle(x,y-12,20);break;
 case 'towel':for(let i=0;i<3;i++)line(x-10+i*9,y-18-(t*4+i*5)%15,x-9+i*9,y-22-(t*4+i*5)%15,0xffead8,1);break;
 case 'vent':if(this.toggled.get(this.zone+':'+id))for(let i=0;i<3;i++)line(x-14+i*12,y-35,x-8+i*12,y-47,0xbce3dd,1);break;
 case 'cloud':g.fillStyle(0xe3eaf1,.7);for(let i=0;i<4;i++)g.fillEllipse(x-20+i*13+(save.reduced?0:t*3),y-Math.sin(i)*4,24,13);break;
 case 'wish':line(x,y+8,x-14,y-3,0xf4becb,2);line(x-14,y-3,x-8,y-13,0xf4becb,2);line(x-8,y-13,x,y-7,0xf4becb,2);line(x,y-7,x+8,y-13,0xf4becb,2);line(x+8,y-13,x+14,y-3,0xf4becb,2);line(x+14,y-3,x,y+8,0xf4becb,2);break;
 }
 }g.setAlpha(1)}
}
