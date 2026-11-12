import type Phaser from 'phaser';
import type {Zone} from './world';
import {inPolygon,type Polygon} from './navigation';
const pane=(x:number,y:number,w:number,h:number):Polygon=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
/** Each pane stops inside its wooden frame. Never paint over a mullion. */
export const windowPanes:Partial<Record<Zone,Polygon[]>>={
 room:[pane(266,40,45,29),pane(325,40,45,29),pane(266,78,45,19),pane(325,78,45,19),pane(165,58,16,34),pane(189,58,14,34)],
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
 for(const points of panes){g.fillStyle(time==='day'?0x99c4d0:time==='dawn'?0xba8399:0x20324b,replace?.94:time==='night'?.08:.27);g.fillPoints(points.map(([x,y])=>({x,y})),true)}
 if(replace){const color=time==='day'?0xffdf9e:time==='dawn'?0xffbd95:0xf8e9c6;g.fillStyle(color,.9);g.fillCircle(347,time==='night'?53:55,time==='night'?5:7);if(time==='night'){g.fillStyle(0x20324b,1);g.fillCircle(350,51,4)}}
 if(weather==='clear')return;
 for(let i=0;i<170;i++){const x=(i*79+clock*(weather==='rain'?5:2))%640,y=(i*43+clock*(weather==='rain'?95:15))%427,dy=weather==='rain'?5:1;
  if(windowContains(zone,x,y)&&windowContains(zone,x,y+dy)){g.fillStyle(weather==='rain'?0xc1e1ef:0xfff8e5,.78);g.fillRect(Math.floor(x),Math.floor(y),1,dy)}
 }
}
