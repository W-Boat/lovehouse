import {advanceAlong,findPath,nearestWalkable,type Point,type Walkable} from './navigation';
export type ActorState='idle'|'moving'|'approaching'|'preparing'|'interacting'|'seated'|'transition';
export type ActionDefinition={id:string;duration:number;contact:number;recover:number};
export const actions:Record<string,ActionDefinition>={hug:{id:'hug',duration:2.4,contact:.55,recover:1.9},head:{id:'head',duration:2.2,contact:.6,recover:1.7},shoulder:{id:'shoulder',duration:3.2,contact:.8,recover:2.8},flower:{id:'flower',duration:2.4,contact:.8,recover:2},share:{id:'share',duration:2.8,contact:.7,recover:2.3},dance:{id:'dance',duration:8,contact:.2,recover:7.5},scare:{id:'scare',duration:2.5,contact:.2,recover:2},hand:{id:'hand',duration:1,contact:.5,recover:.8}};
/** Versioned commands own all position writes; callbacks from cancelled commands cannot run. */
export class ActorController{
 state:ActorState='idle';generation=0;private route:Point[]=[];private done?:()=>void;
 cancel(state:ActorState='idle'){this.generation++;this.route=[];this.done=undefined;this.state=state}
 move(actor:Point,target:Point,floor:Walkable,done?:()=>void){this.cancel('moving');this.route=findPath(actor,target,floor);if(!this.route.length){this.state='idle';return false}const generation=this.generation;this.done=()=>{if(generation===this.generation)done?.()};return true}
 update(actor:Point,dt:number,floor:Walkable,speed=84){if(this.state!=='moving'&&this.state!=='approaching')return false;const moved=advanceAlong(actor,this.route,Math.min(.04,Math.max(0,dt))*speed,floor);if(!this.route.length){this.state='idle';const done=this.done;this.done=undefined;done?.()}return moved>0}
 get moving(){return this.route.length>0}
}
export function sideBySide(leader:Point,follower:Point,floor:Walkable):Point|undefined{const sign=follower.x<leader.x?-1:1;for(const dx of [18*sign,-18*sign]){const p={x:leader.x+dx,y:leader.y};if(floor(p))return p}return undefined}
export function safeContact(point:Point,floor:Walkable){return nearestWalkable(point,floor,48)}
