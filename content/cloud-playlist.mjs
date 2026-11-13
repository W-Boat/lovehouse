export function validateCloudPlaylist(input) {
 if (input === undefined) return;
 if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Expected a musicRoom object');
 const {mode,server,id,type,api,localTracks} = input;
 const https = value => {
  if (typeof value !== 'string' || value.length > 2048 || /[<>"'\s]/.test(value)) return false;
  try {
   const url = new URL(value);
   return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
 };
 const media = value => https(value) || typeof value === 'string' && /^(assets|audio|music)\/(?:[\w-]+\/)*[\w.-]+$/.test(value) && !value.endsWith('/..');
 if (!['online','offline'].includes(mode)) throw Error('Invalid musicRoom.mode');
 if (mode === 'online' || server !== undefined || id !== undefined || type !== undefined || api !== undefined) {
  if (!['netease','tencent','kugou'].includes(server) || typeof id !== 'string' || !/^[\w-]{1,64}$/.test(id) ||
      !['playlist','album','song'].includes(type) || !https(api)) throw Error('Invalid HeoMusic playlist configuration');
 }
 if (mode === 'offline' || localTracks !== undefined) {
  if (!Array.isArray(localTracks) || localTracks.length < 1 || localTracks.length > 60) throw Error('Expected 1–60 localTracks');
  if (localTracks.some(t => !t || typeof t.name !== 'string' || !t.name.trim() || t.name.length > 100 ||
      typeof t.artist !== 'string' || t.artist.length > 100 || !media(t.url) ||
      !(t.cover === '' || media(t.cover)) || !(t.lrc === '' || media(t.lrc)))) throw Error('Invalid musicRoom track');
 }
 return {mode,server,id,type,api,localTracks:localTracks?.map(({name,artist,url,cover,lrc})=>({name,artist,url,cover,lrc}))};
}
