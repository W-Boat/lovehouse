import type Phaser from 'phaser';
import type {Cottage} from './scene';
import {windowPanes} from './window-weather';
/** The scenery changes behind the original mullions and flowers, not over the room. */
export class WindowView{
 private texture:Phaser.Textures.CanvasTexture;
 private image:Phaser.GameObjects.Image;
 private state='';
 constructor(private scene:Cottage){
  this.texture=scene.textures.createCanvas('window-live',640,427)!;
  this.image=scene.add.image(0,0,'window-live').setOrigin(0).setDepth(1.2);
 }
 update(){
  const {scene}=this;this.image.setVisible(scene.zone==='room');if(scene.zone!=='room')return;
  const state=scene.weather+':'+scene.daylight;if(this.state===state)return;this.state=state;
  const source=scene.textures.get('window-views').getSourceImage() as HTMLImageElement;
  const column=scene.weather==='rain'?1:scene.weather==='snow'?2:0,row=scene.daylight==='day'?2:scene.daylight==='dawn'?1:0;
  const left=Math.round(column*source.width/3),top=Math.round(row*source.height/3),w=Math.round((column+1)*source.width/3)-left,h=Math.round((row+1)*source.height/3)-top;
  const g=this.texture.getContext();g.clearRect(0,0,640,427);g.imageSmoothingEnabled=false;
  for(const points of windowPanes.room??[]){
   g.save();g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.clip();
   if(points[0][0]<210)g.drawImage(source,left,top,w,h,172,53,36,39);
   else g.drawImage(source,left,top,w,h,260,18,118,80);
   g.restore();
  }
  this.texture.refresh();
 }
}
