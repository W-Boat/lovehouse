import {moveWithCollision,segmentWalkable,type Point,type Walkable} from './navigation';
/** Only this controller writes the companion while a hand formation is being acquired. */
export class HandFormation{
 active=false;
 reset(){this.active=false}
 update(companion:Point,leader:Point,dt:number,floor:Walkable,gap=28){
  const target={x:leader.x+gap,y:leader.y};
  const distance=Math.hypot(target.x-companion.x,target.y-companion.y);
  if(!floor(target)||!segmentWalkable(leader,target,floor)||distance>110||!segmentWalkable(companion,target,floor)){this.active=false;return false}
  if(distance>.001){const step=Math.min(distance,Math.max(0,Math.min(dt,.04))*112);moveWithCollision(companion,(target.x-companion.x)/distance*step,(target.y-companion.y)/distance*step,floor)}
  this.active=Math.hypot(target.x-companion.x,target.y-companion.y)<.75;
  return true;
 }
}
