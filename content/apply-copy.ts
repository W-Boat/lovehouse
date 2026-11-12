import {films} from './films';
import personal from './personal.json';
import {birthdayConfig as config} from './birthday-config';
import {places} from './places';
const texts=personal.texts as Record<string,string>;
config.welcome=texts['welcome']??config.welcome;config.letterText=texts['birthday.letter']??config.letterText;
config.notes=config.notes.map((v,i)=>texts['note.'+i]??v);
for(const g of config.gifts)g.message=texts['gift.'+g.id+'.message']??g.message;
for(const [id,p]of Object.entries(places)){p.text=texts['place.'+id+'.text']??p.text;p.response=texts['place.'+id+'.response']??p.response;p.choice=texts['place.'+id+'.choice']??p.choice}
config.birthDateForMoon=personal.birthDateForMoon;config.moonImage=personal.moonImage;config.labubuReveal.image=personal.labubuImage;config.mysteryBoxReveal.image=personal.mysteryImage;
export {personal};

for(const [id,film]of Object.entries(films))film.lines=film.lines.map((line,i)=>texts['film.'+id+'.'+i]??line);

config.keychainLines=config.keychainLines.map((v,i)=>texts['keychain.'+i]??v);
