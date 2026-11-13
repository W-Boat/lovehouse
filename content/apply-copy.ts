import {films} from './films';
import personal from './personal.json';
import {birthdayConfig as config} from './birthday-config';
import {places} from './places';
import {worlds,type World} from '../src/world';
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
const texts=personal.texts as Record<string,string>;
applyWorldCopy(texts);
config.welcome=texts['welcome']??config.welcome;config.letterText=texts['birthday.letter']??config.letterText;
config.notes=config.notes.map((v,i)=>texts['note.'+i]??v);
for(const g of config.gifts)g.message=texts['gift.'+g.id+'.message']??g.message;
for(const [id,p]of Object.entries(places)){p.text=texts['place.'+id+'.text']??p.text;p.response=texts['place.'+id+'.response']??p.response;p.choice=texts['place.'+id+'.choice']??p.choice}
config.birthDateForMoon=personal.birthDateForMoon;config.moonImage=personal.moonImage;config.labubuReveal.image=personal.labubuImage;config.mysteryBoxReveal.image=personal.mysteryImage;
export {personal};

// Existing film.<id>.<index> copy IDs remain valid as shorts gain new shots.
for(const [id,film]of Object.entries(films))film.shots.forEach((shot,i)=>{shot.line=texts['film.'+id+'.'+i]??shot.line});

config.keychainLines=config.keychainLines.map((v,i)=>texts['keychain.'+i]??v);

// UI copy resolves the same personal.texts dictionary through uiCopy(id);
// changing labels never changes DOM IDs, action keys or settings tab routing.
