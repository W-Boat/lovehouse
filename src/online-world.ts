import type {Cottage} from './scene';
import type {OnlineClient,ConnectionState} from './online-client';
import type {PlayerState,RoomSnapshot,Role,Position,AffectionState} from './online-protocol';
import {worlds,type Zone} from './world';
import {findPath,segmentWalkable} from './navigation';
import {HandFormation} from './hand-formation';
import {FootstepFollower} from './follow';
/** One local controller owns one actor. Network targets never write the local actor. */
export class OnlineWorld{
 active=false;role:Role='host';playerId='';remote?:PlayerState;snapshot?:RoomSnapshot;
 private handFormation=new HandFormation();private affectionId='';private readySent='';private clockOffset=0;private affectionListeners=new Set<()=>void>();private equipmentSent='';private elapsed=0;private sent='';private remoteZone='';private follower=new FootstepFollower();private crossing='';
 constructor(private scene:Cottage,private client:Pick<OnlineClient,'send'>){}
 handleMessage(message:{type:string;[key:string]:unknown}){
  if(message.type==='welcome'){this.playerId=String(message.playerId);this.role=message.role==='guest'?'guest':'host';this.active=true;this.scene.stop();this.scene.seated='';this.handleSnapshot(message.snapshot as RoomSnapshot)}
  if(message.type==='snapshot')this.handleSnapshot(message.snapshot as RoomSnapshot);
  if(message.type==='event'&&message.event==='move'&&message.playerId!==this.playerId&&this.remote){const p=message.data as Position;if(p&&p.zone in worlds&&Number.isFinite(p.x)&&Number.isFinite(p.y))this.remote={...this.remote,position:p}}
 }
 handleSnapshot(snapshot:RoomSnapshot,playerId?:string){if(playerId)this.playerId=playerId;if(!snapshot||!Array.isArray(snapshot.players))return;this.snapshot=snapshot;const self=snapshot.players.find(p=>p.id===this.playerId);if(self){this.role=self.role;this.active=true}if(typeof snapshot.serverNow==='number')this.clockOffset=snapshot.serverNow-Date.now();this.affectionListeners.forEach(fn=>fn());this.remote=snapshot.players.find(p=>p.id!==this.playerId&&p.connected)}
 handleConnection(state:ConnectionState){if(state!=='connected'){this.active=false;if(this.snapshot)this.snapshot={...this.snapshot,affection:null};this.affectionId='';this.readySent='';this.affectionListeners.forEach(fn=>fn());this.remote=undefined;this.sent='';this.equipmentSent='';this.follower.enabled=false;this.scene.resetOnlineControl();this.scene.player?.setVisible(true);this.scene.boy?.setVisible(true);this.scene.syncFollowing()}}
 subscribeAffection(fn:()=>void){this.affectionListeners.add(fn);return()=>{this.affectionListeners.delete(fn)}}
 requestAffection(kind:'hand'|'hug'){const s=this.scene,r=this.remote;if(!this.active||!r||r.position.zone!==s.zone||s.seated)return false;const leader=this.role==='host'?this.local:r.position;
  for(const dx of [s.actorHeight*.4375||28,-(s.actorHeight*.4375||28)]){const host={x:leader.x+Math.min(0,dx),y:leader.y},guest={x:leader.x+Math.max(0,dx),y:leader.y};if(!s.walkable(host)||!s.walkable(guest)||!segmentWalkable(host,guest,s.walkable)||!findPath(this.local,this.role==='host'?host:guest,s.walkable).length)continue;return this.client.send({type:'affection-invite',kind,zone:s.zone,host,guest})}return false}
 answerAffection(accept:boolean){const a=this.snapshot?.affection;if(a)this.client.send({type:'affection-answer',id:a.id,accept})}
 cancelAffection(){const a=this.snapshot?.affection;if(a){this.client.send({type:'affection-cancel',id:a.id});this.snapshot={...this.snapshot!,affection:null,following:a.kind==='hand'?false:this.snapshot!.following};this.scene.stop();this.affectionId='';this.readySent='';this.affectionListeners.forEach(fn=>fn())}}
 private updateAffection(){const a=this.snapshot?.affection,s=this.scene;if(a&&Date.now()+this.clockOffset>a.expires){this.cancelAffection();return false}if(!a||a.phase==='invited'){if(this.affectionId){this.affectionId='';this.readySent='';const other=this.role==='guest'?s.player:s.boy;other.setVisible(Boolean(this.remote&&this.remote.position.zone===s.zone))}return false}if(this.handWalking){if(a.zone!==s.zone||this.remote?.position.zone!==s.zone||s.transitioning)return false;const host=this.role==='host'?this.local:this.remote.position,guest=this.role==='guest'?this.local:this.remote.position,gap=s.actorHeight*.4375||28;if(Math.hypot(guest.x-host.x-gap,guest.y-host.y)>7||!segmentWalkable(host,guest,s.walkable))return false;const elapsed=(Date.now()+this.clockOffset-(a.startedAt??0))/1000;if(elapsed<0)return false;const direction=this.role==='host'?s.onlineDirection:this.remote.position.direction,moving=(this.role==='host'?s.onlinePose:this.remote.position.pose)==='move';s.renderOnlineContact({...a,host:{x:host.x,y:host.y},guest:{x:guest.x,y:guest.y}},elapsed,direction,moving);return true}if(a.zone!==s.zone||!this.remote||!s.walkable(a.host)||!s.walkable(a.guest)||!segmentWalkable(a.host,a.guest,s.walkable)){this.cancelAffection();return false}
  const target=a[this.role];if(this.affectionId!==a.id){if(!findPath(this.local,target,s.walkable).length){this.cancelAffection();return false}this.affectionId=a.id;this.readySent='';s.stop();if(s.prepareOnlineContact)s.prepareOnlineContact(target);else s.walk(target)}
  if(a.phase==='approaching'){if(Math.hypot(this.local.x-target.x,this.local.y-target.y)<3&&this.readySent!==a.id){this.client.send({type:'move',zone:s.zone,x:this.local.x,y:this.local.y,direction:this.role==='host'?3:1,pose:'idle'});this.client.send({type:'affection-ready',id:a.id});this.readySent=a.id}return false}
  const elapsed=(Date.now()+this.clockOffset-(a.startedAt??0))/1000;if(elapsed<0)return false;if(a.kind==='hug'&&elapsed>2.4){this.cancelAffection();return false}s.renderOnlineContact(a,elapsed);return true;
 }
 get handWalking(){return this.snapshot?.affection?.kind==='hand'&&this.snapshot.affection.phase==='playing'&&this.snapshot.following}
 get contactPlaying(){return this.snapshot?.affection?.phase==='playing'}
 get local(){return this.role==='guest'?this.scene.boy:this.scene.player}
 cancelFollowing(){if(this.role==='guest'&&this.snapshot?.following){this.client.send({type:'follow-stop'});this.snapshot={...this.snapshot,following:false};this.follower.enabled=false}}
 update(dt:number){if(!this.active)return;const s=this.scene,remote=this.remote,other=this.role==='guest'?s.player:s.boy;
  if(this.role==='guest'&&this.snapshot?.following&&remote){if(remote.position.zone!==s.zone){if(!s.transitioning&&this.crossing!==remote.position.zone&&remote.position.zone in worlds){this.crossing=remote.position.zone;void s.transitionTo(remote.position.zone as Zone,()=>{this.crossing='';this.follower.enabled=false})}}else if(!s.blocked){if(!this.follower.enabled)this.follower.setEnabled(true,remote.position,this.local,s.walkable);const forming=this.handWalking&&this.handFormation.update(this.local,remote.position,dt,s.walkable,s.actorHeight*.4375||28);if(!forming)this.follower.update(this.local,remote.position,dt,s.walkable)}}else this.follower.enabled=false;
  const visible=Boolean(remote&&remote.position.zone===s.zone);other.setVisible(visible);
  if(visible&&remote){const p=remote.position,first=this.remoteZone!==p.zone;this.remoteZone=p.zone;if(first){other.setPosition(p.x,p.y)}else{const dx=p.x-other.x,dy=p.y-other.y,d=Math.hypot(dx,dy),step=Math.min(d,Math.max(100,d*7)*dt);if(d>.01)other.setPosition(other.x+dx/d*step,other.y+dy/d*step)}s.renderOnlineActor(other,this.role==='guest'?'girl':'boy',p.direction,Math.hypot(p.x-other.x,p.y-other.y)>1,p.pose,remote.appearance)}else this.remoteZone='';
  this.updateAffection();const equipment=s.networkEquipment?.();if(equipment){const key=JSON.stringify(equipment);if(key!==this.equipmentSent&&this.client.send({type:'equipment',...equipment}))this.equipmentSent=key}
  this.elapsed+=dt;if(this.elapsed>=.1){this.elapsed%=.1;const p={zone:s.zone,x:this.local.x,y:this.local.y,direction:s.onlineDirection,pose:s.onlinePose},key=JSON.stringify(p);if(key!==this.sent&&this.client.send({type:'move',...p}))this.sent=key}
 }
 dispose(){this.handleConnection('offline');this.scene.onlineWorld=undefined}
}
export function installOnlineWorld(scene:Cottage,client:Pick<OnlineClient,'send'>){const world=new OnlineWorld(scene,client);scene.onlineWorld=world;return world}
