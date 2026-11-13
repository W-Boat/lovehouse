import type Phaser from 'phaser';
import type {Cottage} from './scene';
import {save} from './state';
import type {Zone} from './world';
export type EffectKind='fire'|'lamp'|'tea'|'book'|'flower'|'chime'|'wave'|'fountain'|'flies'|'stars'|'bottle'|'seed'|'water'|'photo'|'bell'|'stamp'|'drip'|'jelly'|'echo'|'toast'|'potion'|'rune'|'chess'|'box'|'projector'|'popcorn'|'candle'|'stick'|'towel'|'ripple'|'wish'|'cloud'|'vent';
export const placeEvents:Partial<Record<Zone,Record<string,EffectKind>>>={
 room:{fireplace:'fire','room-lights':'lamp',tea:'tea',books:'book',flowers:'flower',candles:'candle',cabinet:'box'},garden:{chime:'chime',shell:'wave'},forest:{fountain:'fountain',fireflies:'flies',lanterns:'lamp'},pier:{telescope:'stars',bottle:'bottle',tide:'wave'},greenhouse:{seed:'seed','greenhouse-water':'water','greenhouse-vent':'vent'},memory:{'memory-photos':'photo','memory-books':'book','memory-lamp':'lamp','memory-tea':'tea'},station:{'station-bell':'bell',clouds:'cloud'},postoffice:{postmark:'stamp','rain-awning':'drip'},aquarium:{jellyfish:'jelly','ocean-echo':'echo'},camp:{marshmallow:'toast','camp-lights':'lamp'},magic:{potion:'potion',spell:'rune'},haunted:{'ghost-chess':'chess','ghost-box':'box',portrait:'photo'},cinema:{projector:'projector',popcorn:'popcorn','cinema-lamp':'lamp'},ferris:{'ferris-lights':'lamp','ferris-wish':'wish'},mars:{lightstick:'stick','mars-dance':'rune'},hotspring:{'spring-petals':'ripple','spring-towel':'towel','spring-tea':'tea'},market:{'market-flower':'flower','market-cake':'candle','market-bread':'toast'},aurora:{'aurora-fire':'fire','aurora-wish':'wish','aurora-tea':'tea'}};
/** Repeated interactions replay a concrete object operation, not an indefinite particle flag. */
export class PlaceEffects{
 private ink:Phaser.GameObjects.Graphics;private active=new Map<string,{kind:EffectKind;x:number;y:number;age:number}>();private zone:Zone;private toggled=new Map<string,boolean>();
 constructor(private scene:Cottage){this.zone=scene.zone;this.ink=scene.add.graphics().setDepth(8.6)}
 rebuild(){this.active.clear();this.ink.clear();this.zone=this.scene.zone}
 trigger(id:string){const kind=placeEvents[this.scene.zone]?.[id],item=this.scene.getItem(id);if(!kind||!item)return false;
  if(this.zone!==this.scene.zone)this.rebuild();this.toggled.set(this.zone+':'+id,!this.toggled.get(this.zone+':'+id));this.active.set(id,{kind,x:item.x,y:item.y,age:0});return true;
 }
 update(delta:number){if(this.zone!==this.scene.zone)this.rebuild();const g=this.ink;g.clear();for(const [id,e]of this.active){e.age+=Math.max(0,Math.min(delta,100))/1000;if(e.age>7){this.active.delete(id);continue}const t=save.reduced?2:e.age,p=Math.min(1,t/2),x=e.x,y=e.y,alpha=Math.min(1,(7-e.age)/1.2);g.setAlpha(alpha);
 const line=(a:number,b:number,c:number,d:number,color=0xf4dbb4,w=2)=>{g.lineStyle(w,color,1);g.lineBetween(a,b,c,d)};
 const box=(a:number,b:number,w:number,h:number,color:number)=>{g.fillStyle(color,1);g.fillRect(a,b,w,h)};
 const ring=(a:number,b:number,r:number,color=0xc2e8e5)=>{g.lineStyle(1,color,.65);g.strokeEllipse(a,b,r*2,r*.6)};
 switch(e.kind){
 case 'fire':box(x-10+10*p,y+8,18,4,0x724329);for(let i=0;i<4;i++){g.fillStyle(i%2?0xffbc61:0xffe0a1,.65);g.fillTriangle(x-12+i*7,y+9,x-5+i*7,y-8-8*Math.sin(t*5+i)**2,x+1+i*7,y+9)}break;
 case 'lamp':{const on=this.toggled.get(this.zone+':'+id);g.fillStyle(0xffdc94,on?.2:.035);g.fillCircle(x,y,30);if(on)for(let i=0;i<5;i++){g.fillStyle(0xffe4ac,.8);g.fillCircle(x-30+i*15,y+Math.sin(i)*4,2)}break}
 case 'tea':for(let i=0;i<2;i++){box(x-14+i*23,y,12,8,0xf4dfb9);box(x-12+i*23,y+1,8,3,0xb37f53);line(x-10+i*23,y-5,x-7+i*23+Math.sin(t*2+i)*3,y-11-(t*4)%12,0xf7e9d7,1)}if(t<2)line(x-20+15*p,y-20,x-10,y,0xb5895e);break;
 case 'book':box(x-23,y-15,46,31,0x704a3c);box(x-21,y-13,20,26,0xf1d9a8);box(x+1,y-13,20,26,0xf1d9a8);for(let i=0;i<4;i++)line(x-17,y-8+i*5,x-5,y-8+i*5,0x967a63,1);{const fold=Math.cos(Math.min(1,t/3)*Math.PI);g.fillStyle(0xffebc8,1);g.fillTriangle(x,y-13,x+21*fold,y-10,x,y+13)}break;
 case 'flower':for(let i=0;i<5;i++){const a=i*1.25;g.fillStyle(i%2?0xf7b9c4:0xffdba8,1);g.fillCircle(x+Math.cos(a)*8,y-5+Math.sin(a)*8,5)}line(x,y,x+Math.sin(t)*3,y+22,0x749b62);break;
 case 'chime':line(x,y-20,x+Math.sin(t*5)*9*(1-p*.8),y,0xbca16b);g.fillStyle(0xffd79f,.8);g.fillEllipse(x+Math.sin(t*5)*9*(1-p*.8),y,10,13);break;
 case 'wave':case 'echo':case 'fountain':case 'ripple':for(let i=0;i<3;i++)ring(x,y,5+(t*10+i*9)%33);if(e.kind==='fountain')for(let i=0;i<5;i++)line(x,y,x-15+i*7,y-20+Math.abs(i-2)*5,0xb5e1ea,1);break;
 case 'flies':for(let i=0;i<9;i++){const a=i*2+t;g.fillStyle(0xe5f69b,.7);g.fillCircle(x+Math.cos(a)*18*(1-p*.65),y-10+Math.sin(a*.7)*15,1.5)}break;
 case 'stars':g.fillStyle(0x172d4b,.95);g.fillCircle(x,y,26);for(let i=0;i<7;i++){const a=i*2.3;box(x+Math.cos(a)*18,y+Math.sin(a)*18,2,2,0xffefb5)}line(x-14,y+14,x+16,y-14,0x9ab8d4,1);break;
 case 'bottle':box(x-7,y-16,14,25,0x75b9b6);box(x-3,y-22,6,7,0x9b7755);box(x-5,y-10-8*p,10,16,0xf1ddac);break;
 case 'seed':box(x-15,y+8,30,8,0x785135);line(x,y+8,x,y+8-26*p,0x82b568,3);g.fillStyle(0x9bd279,1);g.fillEllipse(x-6*p,y-10*p,12*p,5);g.fillEllipse(x+6*p,y-15*p,12*p,5);break;
 case 'water':box(x-22,y-27,19,13,0x7eafb2);line(x-4,y-22,x+10,y-15,0x9ad4dc,3);for(let i=0;i<6;i++)box(x+10+i%3*4,y-12+(t*15+i*6)%23,1,3,0xb4e5f1);break;
 case 'photo':g.fillStyle(0xf0d7ac,1);g.fillRect(x-25,y-20,50,40);g.fillStyle(0x4f6c72,1);g.fillRect(x-21,y-16,42,29);g.fillStyle(0x9cb6a2,1);g.fillTriangle(x-20,y+12,x-5,y-9,x+10,y+12);g.fillStyle(0xe8c88c,1);g.fillCircle(x+12,y-8,4);break;
 case 'bell':line(x,y-20,x+Math.sin(t*4)*7,y-5,0xc8a36a);g.fillStyle(0xe1bb77,1);g.fillEllipse(x+Math.sin(t*4)*7,y-3,19,18);box(x-12,y+4,24,3,0x9b7343);break;
 case 'stamp':box(x-23,y-13,46,31,0xf6dfbc);g.lineStyle(2,0x9c5865,1);g.strokeCircle(x,y+2,12);line(x-7,y+2,x+7,y+2,0x9c5865);if(t<2)box(x-7,y-25+20*p,14,14,0x936447);break;
 case 'drip':for(let i=0;i<5;i++){const yy=y+(t*20+i*8)%35;box(x-23+i*11,yy,1,4,0xafd2df);ring(x-23+i*11,y+36,3+(t*6+i)%8)}break;
 case 'jelly':g.fillStyle(0xc79ae5,.6);g.fillEllipse(x+Math.sin(t)*12,y-8,28,19);for(let i=0;i<4;i++)line(x-9+i*6+Math.sin(t)*12,y,x-9+i*6+Math.sin(t+i)*4,y+14,0xe7bfe9,1);break;
 case 'toast':line(x-25,y+22,x+20,y-9,0xa77c50,3);box(x+6,y-15,15,12,t>2?0xd7ad77:0xfff0d7);break;
 case 'potion':g.fillStyle(0x698fa8,.85);g.fillEllipse(x,y,23,28);box(x-5,y-25,10,13,0x9ac5c9);g.fillStyle(t<2?0xb2d5d4:0xe8a7d6,.85);g.fillEllipse(x,y+4,19,17);for(let i=0;i<3;i++)ring(x-7+i*7,y-(t*8+i*9)%30,2);break;
 case 'rune':g.lineStyle(2,0xd5b4ec,.8);g.strokeCircle(x,y,23);for(let i=0;i<5;i++){const a=i*Math.PI*.8;line(x+Math.cos(a)*19,y+Math.sin(a)*19,x+Math.cos(a+Math.PI*.8)*19,y+Math.sin(a+Math.PI*.8)*19,0xf3d0df,1)}break;
 case 'chess':for(let a=0;a<4;a++)for(let b=0;b<4;b++)box(x-20+a*10,y-20+b*10,10,10,(a+b)%2?0x785c5a:0xe0c9a2);g.fillStyle(0xe1b2cf,1);g.fillCircle(x-15+20*p,y-15+10*p,4);break;
 case 'box':box(x-20,y-4,40,22,0x926647);g.fillStyle(0xcf9d67,1);g.fillTriangle(x-21,y-5,x+21,y-5,x+15,y-5-22*p);break;
 case 'projector':g.fillStyle(0xf7e6b2,.13);g.fillTriangle(x,y,x-180,y-65,x-180,y+60);g.lineStyle(2,0xd9c5a1,1);g.strokeCircle(x,y-9,9);g.strokeCircle(x+17,y-9,9);for(let i=0;i<3;i++){const a=t*2+i*2;line(x,y-9,x+Math.cos(a)*8,y-9+Math.sin(a)*8,0x665e62,1)}break;
 case 'popcorn':box(x-14,y-10,28,27,0xd48687);for(let i=0;i<7;i++){g.fillStyle(0xffe7ad,1);g.fillCircle(x-12+i*4,y-12-Math.sin(i)*4,4)}break;
 case 'candle':box(x-3,y-8,6,22,0xf6ddbd);g.fillStyle(0xffce78,.9);g.fillEllipse(x,y-14+(save.reduced?0:Math.sin(t*4)),5,11);break;
 case 'stick':line(x,y+18,x-6*Math.sin(t*2),y-16,0xf5a5cf,5);g.fillStyle(0xf8b6da,.16);g.fillCircle(x,y-12,20);break;
 case 'towel':box(x-22,y-10,44,24,0xf7e7d2);for(let i=0;i<4;i++)line(x-17+i*10,y-7,x-17+i*10,y+11,0xd4bfa8,1);line(x-15,y-16,x-12,y-24,0xffead8,1);break;
 case 'vent':{const open=this.toggled.get(this.zone+':'+id);g.fillStyle(0x8ab5b6,.6);g.fillRect(x-23,y-17,46,34);g.lineStyle(3,0xe6c68d,1);g.strokeRect(x-23,y-17,46,34);const offset=open?12*p:0;line(x-23,y-17,x+23-offset,y-17-offset,0xf4dbb4,2);line(x+23-offset,y-17-offset,x+23-offset,y+17-offset,0xf4dbb4,2);if(open){for(let i=0;i<3;i++)line(x-14+i*12,y+22,x-8+i*12,y+34,0xbce3dd,1)}break;}
 case 'cloud':g.fillStyle(0xe3eaf1,.7);for(let i=0;i<4;i++)g.fillEllipse(x-20+i*13+(save.reduced?0:t*3),y-Math.sin(i)*4,24,13);break;
 case 'wish':line(x,y+8,x-14,y-3,0xf4becb,2);line(x-14,y-3,x-8,y-13,0xf4becb,2);line(x-8,y-13,x,y-7,0xf4becb,2);line(x,y-7,x+8,y-13,0xf4becb,2);line(x+8,y-13,x+14,y-3,0xf4becb,2);line(x+14,y-3,x,y+8,0xf4becb,2);break;
 }
 }g.setAlpha(1)}
}
