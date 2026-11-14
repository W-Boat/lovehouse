import {films} from './films';
import personal from './personal.json';
import {birthdayConfig as config} from './birthday-config';
import {places} from './places';
import type {CloudScene} from './cloud-scenes.mjs';
import {cloudInteractions,cloudScenes} from '../src/cloud-content';
import {findPath,nearestWalkable} from '../src/navigation';
import type {CloudInteraction} from './cloud-interactions.mjs';
import {worlds,type World,type Zone} from '../src/world';
/** Display copy only. Never replace object IDs, portals, coordinates or keys. */
export function applyWorldCopy(copy:Record<string,string>,definitions:Record<string,World>=worlds){
 for(const [zone,world]of Object.entries(definitions)){
  world.name=copy['scene.'+zone+'.name']??world.name;
  world.caption=copy['scene.'+zone+'.caption']??world.caption;
  for(const item of world.items){
   item.name=copy['item.'+zone+'.'+item.id+'.name']??item.name;
   const action=copy['item.'+zone+'.'+item.id+'.action'];if(typeof action==='string'&&action.trim())item.action=action;
  }
 }
}
export function installCloudInteractions(interactions:CloudInteraction[],definitions:Record<string,World>=worlds,dialogue=places){
 for(const {zone,id,x,y,point,name,action,response,game,url,gameUrl} of interactions){
  if(!Object.hasOwn(definitions,zone))continue;
  const world=definitions[zone];
  if(world.items.some(item=>item.id===id))continue;
  const target={x:point[0],y:point[1]};
  if(!world.walkable(target)||!findPath({x:world.spawn[0],y:world.spawn[1]},target,world.walkable).length)continue;
  world.items.push({id,x,y,point,name,action,kind:'event',texture:url?'ui-door':game||gameUrl?'ui-wand':'ui-letter',practiceGame:game,webPortal:url,externalGame:gameUrl});
  dialogue[id]={text:response,choice:action,response};
 }
}
export function installCloudScenes(scenes:CloudScene[],definitions:Record<string,World>=worlds){
 for(const {id,parent,name,caption,background,entrance,spawn,exit,floor,layers} of scenes){
  if(Object.hasOwn(definitions,id)||!Object.hasOwn(definitions,parent))continue;
  const origin=definitions[parent];
  const [x,y]=entrance;
  const path=findPath({x:origin.spawn[0],y:origin.spawn[1]},{x,y},origin.walkable);
  if(!origin.walkable({x,y})||!path.length)continue;
  const [[left,top],[right,bottom]]=floor;
  const walkable=(p:{x:number;y:number})=>p.x>=left&&p.x<=right&&p.y>=top&&p.y<=bottom;
  const start={x:spawn[0],y:spawn[1]};
  if(!walkable(start)||!walkable({x:exit[0],y:exit[1]}))continue;
  const buddy=nearestWalkable({x:start.x+26,y:start.y},walkable,36)??start;
  definitions[id]={layers,name,caption,texture:id+'-'+Array.from(background).reduce((hash,char)=>(Math.imul(hash,31)+char.charCodeAt(0))|0,0).toString(16),backgroundUrl:background,spawn,boy:[buddy.x,buddy.y],walkable,
   items:[{id:id+'-return',name:origin.name,action:'返回',x:exit[0],y:exit[1],point:exit,to:parent as Zone}]};
  origin.items.push({id:id+'-entrance',name,action:'前往',x,y,point:entrance,to:id});
 }
}
const originalWorlds=Object.fromEntries(Object.entries(worlds).map(([id,world])=>[id,{...world,items:world.items.map(item=>({...item}))}]));
const originalFilms=structuredClone(films);
const originalPlaces=structuredClone(places);
const originalConfig=structuredClone(config);
export function refreshCloudWorld(){
 for(const id of Object.keys(worlds))if(id.startsWith('cloud-'))delete worlds[id as Zone];
 for(const [id,world] of Object.entries(originalWorlds))worlds[id as Zone]={...world,items:world.items.map(item=>({...item}))};
 for(const id of Object.keys(places))if(!Object.hasOwn(originalPlaces,id))delete places[id];
 Object.assign(places,structuredClone(originalPlaces));
 // Gift geometry is applied by the cloud-content installer.
 for(const [key,value] of Object.entries(originalConfig))if(key!=='gifts'&&key!=='girlName'&&key!=='boyName')Object.assign(config,{[key]:structuredClone(value)});
 for(const [id,film] of Object.entries(films))Object.assign(film,structuredClone(originalFilms[id as keyof typeof originalFilms]));
 applyPublishedWorld();
}
function applyPublishedWorld(){
installCloudScenes(cloudScenes);
installCloudInteractions(cloudInteractions);
const texts=personal.texts as Record<string,string>;
applyWorldCopy(texts);
config.welcome=texts['welcome']??config.welcome;config.letterText=texts['birthday.letter']??config.letterText;
config.notes=config.notes.map((v,i)=>texts['note.'+i]??v);
for(const gift of config.gifts){
 for(const field of ['name','subtitle','message','variant'] as const){
  gift[field]=texts['gift.'+gift.id+'.'+field]??gift[field];
 }
}
config.labubuReveal.text=texts['gift.labubu.reveal']??config.labubuReveal.text;
config.mysteryBoxReveal.text=texts['gift.mystery.reveal']??config.mysteryBoxReveal.text;
for(const [id,p]of Object.entries(places)){p.text=texts['place.'+id+'.text']??p.text;p.response=texts['place.'+id+'.response']??p.response;p.choice=texts['place.'+id+'.choice']??p.choice}
config.birthDateForMoon=personal.birthDateForMoon;config.moonImage=personal.moonImage;config.labubuReveal.image=personal.labubuImage;config.mysteryBoxReveal.image=personal.mysteryImage;


// Existing film.<id>.<index> copy IDs remain valid as shorts gain new shots.
for(const [id,film] of Object.entries(films)){
 film.title=texts['film.'+id+'.title']??film.title;
 film.shots.forEach((shot,i)=>{shot.line=texts['film.'+id+'.'+i]??shot.line});
}

config.keychainLines=config.keychainLines.map((v,i)=>texts['keychain.'+i]??v);

// UI copy resolves the same personal.texts dictionary through uiCopy(id);
// changing labels never changes DOM IDs, action keys or settings tab routing.

}
applyPublishedWorld();

export {personal};
