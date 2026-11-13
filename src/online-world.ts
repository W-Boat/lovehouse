import type {Cottage} from './scene';
import type {OnlineClient,ConnectionState} from './online-client';
import type {PlayerState,RoomSnapshot,Role,Position} from './online-protocol';
import {worlds,type Zone} from './world';
import {FootstepFollower} from './follow';
/** One local controller owns one actor. Network targets never write the local actor. */
export class OnlineWorld{
 active=false;role:Role='host';playerId='';remote?:PlayerState;snapshot?:RoomSnapshot;
 private equipmentSent='';private elapsed=0;private sent='';private remoteZone='';private follower=new FootstepFollower();private crossing='';
 constructor(private scene:Cottage,private client:Pick<OnlineClient,'send'>){}
 handleMessage(message:{type:string;[key:string]:unknown}){
  if(message.type==='welcome'){this.playerId=String(message.playerId);this.role=message.role==='guest'?'guest':'host';this.active=true;this.scene.stop();this.scene.seated='';this.handleSnapshot(message.snapshot as RoomSnapshot)}
  if(message.type==='snapshot')this.handleSnapshot(message.snapshot as RoomSnapshot);
  if(message.type==='event'&&message.event==='move'&&message.playerId!==this.playerId&&this.remote){const p=message.data as Position;if(p&&p.zone in worlds&&Number.isFinite(p.x)&&Number.isFinite(p.y))this.remote={...this.remote,position:p}}
 }
 handleSnapshot(snapshot:RoomSnapshot,playerId?:string){if(playerId)this.playerId=playerId;if(!snapshot||!Array.isArray(snapshot.players))return;this.snapshot=snapshot;const self=snapshot.players.find(p=>p.id===this.playerId);if(self){this.role=self.role;this.active=true}this.remote=snapshot.players.find(p=>p.id!==this.playerId&&p.connected)}
 handleConnection(state:ConnectionState){if(state!=='connected'){this.active=false;this.remote=undefined;this.sent='';this.equipmentSent='';this.follower.enabled=false;this.scene.resetOnlineControl();this.scene.player?.setVisible(true);this.scene.boy?.setVisible(true);this.scene.syncFollowing()}}
 get local(){return this.role==='guest'?this.scene.boy:this.scene.player}
 cancelFollowing(){if(this.role==='guest'&&this.snapshot?.following){this.client.send({type:'follow-stop'});this.snapshot={...this.snapshot,following:false};this.follower.enabled=false}}
 update(dt:number){if(!this.active)return;const s=this.scene,remote=this.remote,other=this.role==='guest'?s.player:s.boy;
  if(this.role==='guest'&&this.snapshot?.following&&remote){if(remote.position.zone!==s.zone){if(!s.transitioning&&this.crossing!==remote.position.zone&&remote.position.zone in worlds){this.crossing=remote.position.zone;void s.transitionTo(remote.position.zone as Zone,()=>{this.crossing='';this.follower.enabled=false})}}else if(!s.blocked){if(!this.follower.enabled)this.follower.setEnabled(true,remote.position,this.local,s.walkable);this.follower.update(this.local,remote.position,dt,s.walkable)}}else this.follower.enabled=false;
  const visible=Boolean(remote&&remote.position.zone===s.zone);other.setVisible(visible);
  if(visible&&remote){const p=remote.position,first=this.remoteZone!==p.zone;this.remoteZone=p.zone;if(first){other.setPosition(p.x,p.y)}else{const dx=p.x-other.x,dy=p.y-other.y,d=Math.hypot(dx,dy),step=Math.min(d,Math.max(100,d*7)*dt);if(d>.01)other.setPosition(other.x+dx/d*step,other.y+dy/d*step)}s.renderOnlineActor(other,this.role==='guest'?'girl':'boy',p.direction,Math.hypot(p.x-other.x,p.y-other.y)>1,p.pose,remote.appearance)}else this.remoteZone='';
  const equipment=s.networkEquipment?.();if(equipment){const key=JSON.stringify(equipment);if(key!==this.equipmentSent&&this.client.send({type:'equipment',...equipment}))this.equipmentSent=key}
  this.elapsed+=dt;if(this.elapsed>=.1){this.elapsed%=.1;const p={zone:s.zone,x:this.local.x,y:this.local.y,direction:s.onlineDirection,pose:s.onlinePose},key=JSON.stringify(p);if(key!==this.sent&&this.client.send({type:'move',...p}))this.sent=key}
 }
 dispose(){this.handleConnection('offline');this.scene.onlineWorld=undefined}
}
export function installOnlineWorld(scene:Cottage,client:Pick<OnlineClient,'send'>){const world=new OnlineWorld(scene,client);scene.onlineWorld=world;return world}
