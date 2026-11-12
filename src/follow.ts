import {advanceAlong,findPath,segmentWalkable,type Point,type Walkable} from './navigation';
export class FootstepFollower{
 enabled=false;private route:Point[]=[];private lastLeader?:Point;private walking=false;private stuck=0;
 reset(leader:Point,follower:Point,walkable:Walkable){this.lastLeader={x:leader.x,y:leader.y};this.route=this.enabled?findPath(follower,leader,walkable):[];this.walking=false;this.stuck=0}
 setEnabled(enabled:boolean,leader:Point,follower:Point,walkable:Walkable){this.enabled=enabled;this.reset(leader,follower,walkable)}
 update(follower:Point,leader:Point,dt:number,walkable:Walkable,paused=false){if(!this.enabled)return 0;if(!this.lastLeader)this.reset(leader,follower,walkable);const last=this.lastLeader!;if(Math.hypot(leader.x-last.x,leader.y-last.y)>1.5){if(segmentWalkable(last,leader,walkable))this.route.push({x:leader.x,y:leader.y});else this.route=findPath(follower,leader,walkable);this.lastLeader={x:leader.x,y:leader.y}}if(paused)return 0;
 let length=0,prev:Point=follower;for(const p of this.route){length+=Math.hypot(p.x-prev.x,p.y-prev.y);prev=p}if(length>38)this.walking=true;if(length<26)this.walking=false;if(!this.walking)return 0;
 const moved=advanceAlong(follower,this.route,Math.min(Math.max(0,length-26),Math.max(0,dt)*90),walkable);this.stuck=moved<.001?this.stuck+dt:0;if(this.stuck>1){this.route=findPath(follower,leader,walkable);this.stuck=0}return moved;
 }
}
