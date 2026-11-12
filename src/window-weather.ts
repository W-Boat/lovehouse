import type Phaser from 'phaser';
import type {Zone} from './world';
import {inPolygon,type Polygon} from './navigation';
const pane=(x:number,y:number,w:number,h:number):Polygon=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
/** Each pane stops inside its wooden frame. Never paint over a mullion. */
export const windowPanes:Partial<Record<Zone,Polygon[]>>={
 room:[[[264,49],[277,35],[288,29],[288,50]],[[293,26],[307,21],[317,20],[317,50]],[[323,20],[334,22],[346,27],[346,50]],[[352,30],[365,39],[373,50],[352,50]],pane(263,55,25,17),pane(293,55,24,17),pane(323,55,23,17),pane(352,55,22,17),pane(263,78,24,17),pane(352,78,22,16),pane(174,54,13,14),pane(193,54,12,14),pane(174,74,13,16),pane(193,74,12,16)],
 aquarium:[pane(15,88,29,47),pane(589,80,26,53)],
 cinema:[pane(88,48,26,43),pane(122,48,28,43),pane(453,48,23,43),pane(484,48,22,43)],
 haunted:[pane(107,47,15,55),pane(131,47,12,55),pane(564,38,26,63)],
 greenhouse:[pane(204,25,50,37),pane(270,25,44,37),pane(331,25,45,37),pane(392,25,45,37)],
 hotspring:[pane(120,46,32,45),pane(162,46,34,45),pane(205,46,30,45),pane(124,103,30,29),pane(164,103,33,29),pane(207,103,29,29)],
 aurora:[pane(230,100,78,85),pane(317,100,93,85),pane(426,100,48,80)],
};
export const indoorZones=new Set<Zone>(['room','memory','aquarium','greenhouse','haunted','cinema','magic','hotspring','aurora']);
export function windowContains(zone:Zone,x:number,y:number){return (windowPanes[zone]??[]).some(p=>inPolygon({x,y},p))}
export function renderWindowWeather(g:Phaser.GameObjects.Graphics,zone:Zone,weather:string,time:string,clock:number){
 const panes=windowPanes[zone]??[];
 // Preserve the aurora and mountain panorama; the house's baked moon is replaced.
 const replace=zone==='room';
 for(const points of panes){g.fillStyle(time==='day'?0x99c4d0:time==='dawn'?0xba8399:0x20324b,replace?1:time==='night'?.08:.27);g.fillPoints(points.map(([x,y])=>({x,y})),true)}
 if(replace){const color=time==='day'?0xffdf9e:time==='dawn'?0xffbd95:0xf8e9c6;g.fillStyle(color,.9);g.fillCircle(335,36,time==='night'?6:8);if(time==='night'){g.fillStyle(0x20324b,1);g.fillCircle(338,34,5)}}
 if(weather==='clear')return;
 for(const [index,points]of panes.entries()){
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),left=Math.min(...xs),top=Math.min(...ys),w=Math.max(...xs)-left,h=Math.max(...ys)-top;
  for(let i=0;i<6;i++){const x=Math.floor(left+((i*13+index*7+clock*2)%Math.max(1,w))),y=Math.floor(top+((i*11+clock*(weather==='rain'?35:6))%Math.max(1,h))),dy=weather==='rain'?4:1;
   if(inPolygon({x,y},points)&&inPolygon({x,y:y+dy},points)){g.fillStyle(weather==='rain'?0xc1e1ef:0xfff8e5,.78);g.fillRect(x,y,1,dy)}
  }
 }
}
