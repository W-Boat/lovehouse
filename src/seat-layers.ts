import type Phaser from 'phaser';
import type {Cottage} from './scene';
import {furnishings} from './layouts';
import {worlds} from './world';
import {save} from './state';
type Polygon=readonly (readonly [number,number])[];
const box=(x:number,y:number,w:number,h:number):Polygon=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
/** Foreground furniture remains in front of seated bodies, never in front of their heads by accident. */
export class SeatLayers{
 private layers:{ids:string[];image:Phaser.GameObjects.Image}[]=[];
 constructor(private scene:Cottage){}
 destroy(){this.layers.forEach(l=>l.image.destroy());this.layers=[]}
 rebuild(){
  this.destroy();const s=this.scene;
  for(const p of furnishings[s.zone]??[])if(p.hips){
   const source=s.textures.get(p.texture??'furnishing-'+p.frame).getSourceImage() as HTMLCanvasElement;
   const key='seat-front:'+s.zone+':'+p.id;
   if(!s.textures.exists(key)){
    const c=document.createElement('canvas');c.width=source.width;c.height=source.height;const g=c.getContext('2d')!;g.imageSmoothingEnabled=false;
    if(p.occlusion==='rear')g.drawImage(source,0,0);
    else{g.beginPath();g.rect(0,c.height*.45,c.width*.17,c.height*.5);g.rect(c.width*.83,c.height*.45,c.width*.17,c.height*.5);g.rect(0,c.height*.95,c.width,c.height*.05);g.clip();g.drawImage(source,0,0)}
    s.textures.addCanvas(key,c);
   }
   this.layers.push({ids:[p.id],image:s.add.image(p.x,p.y,key).setOrigin(.5,1).setDisplaySize(p.w,p.h).setDepth(11.2).setVisible(false)});
  }
  const chairArms=[box(62,157,14,27),box(119,153,11,29),box(154,157,12,28),box(209,153,10,32)];
  if(s.zone==='memory')this.backgroundMask(['memory-armchair-left','memory-armchair-right'],chairArms);
  if(s.zone==='room')this.backgroundMask(['sofa','tea'],[box(27,269,15,37),box(118,270,12,36)]);
  if(s.zone==='hotspring')this.backgroundMask(['hotspring-seat'],[
   [[231,244],[240,249],[284,250],[296,244],[294,259],[285,266],[243,264],[232,257]],
   [[371,244],[381,250],[423,251],[435,244],[434,259],[425,267],[383,265],[372,258]],
  ]);
 }
 private backgroundMask(ids:string[],polygons:Polygon[]){
  const s=this.scene,key='seat-background-front:'+s.zone+':'+ids.join(':');
  const points=polygons.flat(),left=Math.floor(Math.min(...points.map(p=>p[0]))),top=Math.floor(Math.min(...points.map(p=>p[1]))),right=Math.ceil(Math.max(...points.map(p=>p[0]))),bottom=Math.ceil(Math.max(...points.map(p=>p[1])));
  if(!s.textures.exists(key)){
   const c=document.createElement('canvas');c.width=right-left;c.height=bottom-top;const g=c.getContext('2d')!;g.imageSmoothingEnabled=false;g.translate(-left,-top);g.beginPath();
   for(const polygon of polygons){polygon.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath()}g.clip();
   const background=s.zone==='room'&&save.celebrated?'room-after':worlds[s.zone].texture;
   g.drawImage(s.textures.get(background).getSourceImage() as HTMLImageElement,0,0,640,426.667);s.textures.addCanvas(key,c);
  }
  this.layers.push({ids,image:s.add.image(left,top,key).setOrigin(0).setDepth(11.2).setVisible(false)});
 }
 update(){for(const l of this.layers)l.image.setVisible(this.scene.hasSeatedBody&&l.ids.includes(this.scene.seated))}
}
