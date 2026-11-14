import '../content/apply-copy';
import {mainCopyDefaults} from '../content/main-copy';
import {uiCopyDefaults} from '../content/ui-copy';
import {gameCopyDefaults} from '../content/game-copy';
import {birthdayConfig} from '../content/birthday-config';
import {films} from '../content/films';
import {places} from '../content/places';
import personal from '../content/personal.json';
import musicRoom from '../content/music-room.json';
import {worlds} from '../src/world';
import {mkdir,readdir,stat,writeFile} from 'node:fs/promises';
import {dirname,extname,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const publicDir=resolve(root,process.argv[2]||'public');
const output=resolve(root,process.argv[3]||'admin/bundled/catalog.json');
const texts:Record<string,string>={};
function addPrefixed(prefix:string,values:Record<string,string>){
 for(const [key,value] of Object.entries(values))texts[prefix+key]=value;
}
addPrefixed('main-ui.',mainCopyDefaults);
addPrefixed('ui.',uiCopyDefaults);
addPrefixed('game-ui.',gameCopyDefaults);
texts.welcome=birthdayConfig.welcome;
texts['birthday.letter']=birthdayConfig.letterText;
birthdayConfig.notes.forEach((value,index)=>{texts['note.'+index]=value});
birthdayConfig.keychainLines.forEach((value,index)=>{texts['keychain.'+index]=value});
for(const gift of birthdayConfig.gifts){
 for(const field of ['name','subtitle','message','variant'] as const)texts['gift.'+gift.id+'.'+field]=gift[field];
}
texts['gift.labubu.reveal']=birthdayConfig.labubuReveal.text;
texts['gift.mysteryBox.reveal']=birthdayConfig.mysteryBoxReveal.text;
for(const [id,place] of Object.entries(places)){
 for(const field of ['text','choice','response'] as const)texts['place.'+id+'.'+field]=place[field];
}
for(const [id,film] of Object.entries(films)){
 texts['film.'+id+'.title']=film.title;
 film.shots.forEach((shot,index)=>{texts['film.'+id+'.'+index]=shot.line});
}
for(const [id,world] of Object.entries(worlds)){
 texts['scene.'+id+'.name']=world.name;
 texts['scene.'+id+'.caption']=world.caption;
 for(const item of world.items){
  const prefix='item.'+id+'.'+item.id+'.';
  texts[prefix+'name']=item.name;
  texts[prefix+'action']=item.action??'';
 }
}
Object.assign(texts,personal.texts);
const {texts:_personalTexts,...media}=personal;
const mimeTypes:Record<string,string>={
 '.avif':'image/avif','.bmp':'image/bmp','.gif':'image/gif','.ico':'image/x-icon',
 '.jpeg':'image/jpeg','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp',
 '.m4a':'audio/mp4','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav',
 '.lrc':'text/plain; charset=utf-8',
};
const assets:{id:string,name:string,mime:string,bytes:number,source:'bundled'}[]=[];
async function scan(directory:string){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const path=join(directory,entry.name);
  if(entry.isDirectory()){await scan(path);continue}
  if(!entry.isFile())continue;
  const id=relative(publicDir,path).replace(/\\/g,'/');
  assets.push({id,name:entry.name,mime:mimeTypes[extname(entry.name).toLowerCase()]??'application/octet-stream',bytes:(await stat(path)).size,source:'bundled'});
 }
}
await scan(publicDir);
assets.sort((a,b)=>a.id.localeCompare(b.id,'en'));
const baseline={worlds:Object.fromEntries(Object.entries(worlds).map(([id,{walkable,...world}])=>[id,world])),gifts:Object.fromEntries(birthdayConfig.gifts.map(({id,icon,...gift})=>[id,gift])),announcement:{enabled:false,title:'',body:''},texts:Object.fromEntries(Object.entries(texts).sort(([a],[b])=>a.localeCompare(b,'en'))),media,musicRoom,portals:[],scenes:[],interactions:[],giftGames:{}};
await mkdir(dirname(output),{recursive:true});
await writeFile(output,JSON.stringify({baseline,assets}));
console.log('Generated',assets.length,'bundled assets and',Object.keys(texts).length,'copy IDs');
