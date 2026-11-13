import {DEFAULT_DPI,validDpi} from './display';
import {calendarDefaults,parseCalendar,type CalendarSettings} from './calendar';
import {birthdayConfig,type GiftId} from '../content/birthday-config';
export const SAVE_KEY='birthday-cottage-v2';
export const snacks=['chestnuts','chocolate','marshmallow'] as const;
export type Snack=(typeof snacks)[number];
export const isSnack=(id:string):id is Snack=>snacks.some(snack=>snack===id);
const portions=3;
export type Appearance={hair:number;color:number;skin:number;outfit:number};
export type WorkshopPhase='order'|'string'|'heat'|'cool'|'sell'|'done';
export type WorkshopDraft={day:number;cash:number;stove:number;heat:number;fruit:number;phase:WorkshopPhase;served:number;recipe:number;orders:number[]};
export type Save={cheat:boolean;resume?:{zone:string;x:number;y:number;boyX:number;boyY:number};workshopDraft?:WorkshopDraft;workshop:{day:number;coins:number;best:number;stove:number};jumpBest:number;cardsWins:number;snackPortions:Record<Snack,number>;quizStars:number;quizRewards:Record<string,number>;calendar:CalendarSettings;version:2;opened:GiftId[];celebrated:boolean;hat:boolean;band:boolean;earphones:boolean;music:boolean;reduced:boolean;visitedGarden:boolean;moments:string[];following:boolean;onboarded:boolean;names:{girl:string;boy:string};appearance:{girl:Appearance;boy:Appearance};inventory:string[];placements:Record<string,string>;visited:string[];games:Record<string,{status:'won'|'skipped';score:number}>;notes:Record<string,string>;settings:{musicVolume:number;sfxVolume:number;ambientVolume:number;haptics:boolean;minimap:boolean;directions:boolean;uiScale:number;quality:'low'|'high';text:'normal'|'large'};sky:{weather:string;time:string}};
const appearance=():Appearance=>({hair:0,color:0,skin:0,outfit:0});
export const defaults=():Save=>({cheat:false,workshop:{day:1,coins:12,best:0,stove:0},jumpBest:0,cardsWins:0,snackPortions:{chestnuts:0,chocolate:0,marshmallow:0},quizStars:0,quizRewards:{},calendar:calendarDefaults(),version:2,opened:[],celebrated:false,hat:false,band:false,earphones:false,music:true,reduced:false,visitedGarden:false,moments:[],following:false,onboarded:false,names:{girl:'你',boy:'我'},appearance:{girl:appearance(),boy:appearance()},inventory:[],placements:{},visited:['room'],games:{},notes:{},settings:{musicVolume:.35,sfxVolume:.55,ambientVolume:.2,haptics:true,minimap:true,directions:false,uiScale:DEFAULT_DPI,quality:'high',text:'normal'},sky:{weather:'clear',time:'night'}});
const clamp=(v:unknown,n:number,d=0)=>Number.isInteger(v)?Math.max(0,Math.min(n,v as number)):d;
export function parseSave(raw:string|null):Save{try{const d=JSON.parse(raw||'null'),s=defaults();if(!d||![1,2].includes(d.version))return s;
 s.workshop={day:clamp(d.workshop?.day,10000,1)||1,coins:clamp(d.workshop?.coins,100000,12),best:clamp(d.workshop?.best,100000),stove:clamp(d.workshop?.stove,2)};s.jumpBest=clamp(d.jumpBest,100000);s.cardsWins=clamp(d.cardsWins,100000);
 const draft=d.workshopDraft;
 if(draft?.day===s.workshop.day&&Array.isArray(draft.orders)&&draft.orders.length===3
  &&draft.orders.every((index:unknown)=>Number.isInteger(index)&&Number(index)>=0&&Number(index)<=2)
  &&['order','string','heat','cool','sell','done'].includes(draft.phase)){
  s.workshopDraft={day:s.workshop.day,cash:clamp(draft.cash,100050),stove:clamp(draft.stove,2),
   heat:clamp(draft.heat,6),fruit:clamp(draft.fruit,3),phase:draft.phase,served:clamp(draft.served,3),
   recipe:clamp(draft.recipe,2),orders:draft.orders};
  const {served,fruit,phase}=s.workshopDraft;
  if((served===3)!==(phase==='done')||(phase==='string'&&fruit===3)
   ||(['heat','cool','sell'].includes(phase)&&fruit!==3))delete s.workshopDraft;
 }
 s.quizStars=clamp(d.quizStars,1000000);
 if(d.quizRewards&&typeof d.quizRewards==='object')for(const [id,count] of Object.entries(d.quizRewards).slice(-128))if(/^[A-Za-z0-9_-]{16}$/.test(id))s.quizRewards[id]=clamp(count,20);
 s.opened=[...new Set<GiftId>((Array.isArray(d.opened)?d.opened:[]).filter((id:GiftId)=>birthdayConfig.gifts.some(g=>g.id===id)))];for(const k of ['celebrated','hat','band','earphones','reduced','visitedGarden','following','onboarded'] as const)s[k]=d[k]===true;s.music=typeof d.music==='boolean'?d.music:true;
 const strings=(v:unknown,max=200)=>[...new Set<string>((Array.isArray(v)?v:[]).filter((x:unknown)=>typeof x==='string'&&/^[a-z][a-z0-9:-]{0,63}$/.test(x as string)).slice(0,max))];s.moments=strings(d.moments);s.visited=[...new Set(['room',...strings(d.visited,30)])];s.inventory=strings(d.inventory,40);
 for(const who of ['girl','boy'] as const){if(typeof d.names?.[who]==='string')s.names[who]=[...d.names[who].trim()].slice(0,12).join('')||s.names[who];const a=d.appearance?.[who];if(a)s.appearance[who]={hair:clamp(a.hair,3),color:clamp(a.color,5),skin:clamp(a.skin,3),outfit:clamp(a.outfit,2)}}
 if(d.version===1){s.onboarded=s.opened.length>0||s.celebrated;if(s.hat)s.inventory.push('hat');if(s.band)s.inventory.push('band')}
 for(const id of s.opened)if(!s.inventory.includes(id))s.inventory.push(id);
 for(const id of snacks)s.snackPortions[id]=clamp(d.snackPortions?.[id],portions,s.inventory.includes(id)?portions:0);
 if(d.notes&&typeof d.notes==='object')for(const [k,v]of Object.entries(d.notes))if(/^[a-z-]{1,40}$/.test(k)&&typeof v==='string')s.notes[k]=v.slice(0,500);
 if(d.placements&&typeof d.placements==='object')for(const [k,v]of Object.entries(d.placements))if(/^[a-z-]+:[a-z-]+$/.test(k)&&typeof v==='string'&&s.inventory.includes(v)&&!Object.values(s.placements).includes(v))s.placements[k]=v;
 if(d.games&&typeof d.games==='object')for(const [k,v]of Object.entries(d.games) as [string,any][])if(birthdayConfig.gifts.some(g=>g.id===k)&&v&&['won','skipped'].includes(v.status))s.games[k]={status:v.status,score:clamp(v.score,100000)};
 if(d.settings){for(const k of ['musicVolume','sfxVolume','ambientVolume'] as const)if(Number.isFinite(d.settings[k]))s.settings[k]=Math.max(0,Math.min(1,d.settings[k]));s.settings.haptics=d.settings.haptics!==false;s.settings.minimap=d.settings.minimap!==false;s.settings.directions=d.settings.directions===true;if(validDpi(d.settings.uiScale))s.settings.uiScale=d.settings.uiScale;s.settings.quality=d.settings.quality==='low'?'low':'high';s.settings.text=d.settings.text==='large'?'large':'normal'}
 s.cheat=d.cheat===true;const pos=d.resume;if(pos&&typeof pos.zone==='string'&&/^[a-z]+$/.test(pos.zone)&&[pos.x,pos.y,pos.boyX,pos.boyY].every((n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=640))s.resume={zone:pos.zone,x:pos.x,y:pos.y,boyX:pos.boyX,boyY:pos.boyY};s.calendar=parseCalendar(d.calendar);if(['clear','rain','snow'].includes(d.sky?.weather))s.sky.weather=d.sky.weather;if(['night','dawn','day','dusk'].includes(d.sky?.time))s.sky.time=d.sky.time;return s}catch{return defaults()}}
export let save:Save;try{save=parseSave(localStorage.getItem(SAVE_KEY)||localStorage.getItem('birthday-cottage-v1'));for(const key of ['birthday-future','birthday-postcard','birthday-aquarium-note']){const v=localStorage.getItem(key);if(v&&!save.notes[key])save.notes[key]=v.slice(0,500)}}catch{save=defaults()}
export function persist(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(save))}catch{if(typeof document!=='undefined')document.dispatchEvent(new CustomEvent('save-error'))}}
export function reset(){delete save.resume;delete save.workshopDraft;Object.assign(save,defaults());persist()}
export function importSave(raw:string){const d=JSON.parse(raw);if(!d||![1,2].includes(d.version))throw Error('不支持的存档');delete save.resume;delete save.workshopDraft;Object.assign(save,parseSave(raw));persist()}
export function grantItem(id:string){if(!save.inventory.includes(id))save.inventory.push(id);persist()}
export function restockSnack(id:Snack){
 if(!save.inventory.includes(id))save.inventory.push(id);
 save.snackPortions[id]=portions;
 persist();
}
export function useSnack(id:Snack){
 if(!save.inventory.includes(id)||save.snackPortions[id]<=0)return false;
 save.snackPortions[id]--;
 persist();
 return true;
}
export function placeItem(slot:string,id:string){if(!save.inventory.includes(id))return false;for(const [k,v]of Object.entries(save.placements))if(v===id)delete save.placements[k];save.placements[slot]=id;persist();return true}

