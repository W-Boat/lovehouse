import initial from '../content/music-room.json';
export type MusicTrack={name:string;artist:string;url:string;cover:string;lrc:string};
export type MusicRoomConfig={mode:'online'|'offline';server:'netease'|'tencent'|'kugou';id:string;type:'playlist'|'album'|'song';api:string;localTracks:MusicTrack[]};
const safeUrl=(value:unknown,empty=false):value is string=>typeof value==='string'&&value.length<=2048&&((empty&&value==='')||(/^(https?:\/\/|(?:assets|audio|music)\/)/.test(value)&&!/[<>"'\s]/.test(value)));
export const validMusicTrack=(t:unknown):t is MusicTrack=>Boolean(t&&typeof t==='object'&&typeof (t as MusicTrack).name==='string'&&safeUrl((t as MusicTrack).url)&&safeUrl((t as MusicTrack).cover,true)&&safeUrl((t as MusicTrack).lrc,true));
export function parseMusicConfig(raw:unknown):MusicRoomConfig{
 const d=raw&&typeof raw==='object'?raw as Partial<MusicRoomConfig>:{};
 const tracks=Array.isArray(d.localTracks)?d.localTracks.slice(0,60).filter(validMusicTrack).map(t=>({name:t.name.slice(0,100),artist:String(t.artist??'').slice(0,100),url:t.url,cover:t.cover,lrc:t.lrc})):[];
 return {mode:d.mode==='online'?'online':'offline',server:['netease','tencent','kugou'].includes(d.server!)?d.server!:'tencent',id:typeof d.id==='string'&&/^[\w-]{1,64}$/.test(d.id)?d.id:initial.id,type:['playlist','album','song'].includes(d.type!)?d.type!:'playlist',api:typeof d.api==='string'&&/^https:\/\//.test(d.api)&&d.api.length<2048?d.api:initial.api,localTracks:tracks.length?tracks:initial.localTracks.map(t=>({...t}))};
}
export const defaultMusicConfig=()=>parseMusicConfig(initial);
