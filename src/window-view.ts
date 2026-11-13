import {drawClimateView} from './climate-art';
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
  const snap=scene.calendarState,state=[snap.enabled,snap.season,snap.weather,Math.floor(snap.minutes),snap.sunrise,snap.sunset,...snap.skyBlend.map(v=>v.toFixed(3))].join(':');if(this.state===state)return;this.state=state;
  const g=this.texture.getContext();g.clearRect(0,0,640,427);g.imageSmoothingEnabled=false;
  for(const points of windowPanes.room??[]){
   g.save();g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.clip();
   drawClimateView(g,scene.textures,snap,points[0][0]<210?{x:172,y:53,w:36,h:39}:{x:260,y:18,w:118,h:80});
   g.restore();
  }
  this.texture.refresh();
 }
}
