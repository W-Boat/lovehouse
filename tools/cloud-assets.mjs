import {createHash, randomUUID} from 'node:crypto';
import {mkdir, readdir, readFile, rename, rm, writeFile} from 'node:fs/promises';
import {join} from 'node:path';

export const assetLimit = 16 * 1024 * 1024;
const formats = new Map([
 ['png','image/png'],['webp','image/webp'],['jpg','image/jpeg'],['avif','image/avif'],
 ['mp3','audio/mpeg'],['wav','audio/wav'],['ogg','audio/ogg'],['m4a','audio/mp4'],
 ['lrc','text/plain; charset=utf-8'],['html','text/html; charset=utf-8'],['zip','application/zip'],['json','application/json'],['gif','image/gif'],['flac','audio/flac'],['mp4','video/mp4'],
]);
const idPattern = /^[a-f0-9]{64}\.(png|webp|jpg|avif|mp3|wav|ogg|m4a|lrc|html|zip|json|gif|flac|mp4)$/;
export const isAssetId = id => idPattern.test(id);

function matchesFormat(bytes,ext) {
 const at = (offset,signature) => bytes.subarray(offset,offset+signature.length).equals(Buffer.from(signature,'binary'));
 if(ext==='zip')return at(0,'PK\x03\x04');
 if(ext==='gif')return at(0,'GIF87a')||at(0,'GIF89a');
 if(ext==='flac')return at(0,'fLaC');
 if(ext==='mp4')return at(4,'ftyp');
 if(ext==='html'||ext==='json'){
  try{const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
   if(ext==='json'){JSON.parse(text);return true}
   return /<(?:!doctype html|html|head|body|div|script|main|meta|style|title)[\s>]/i.test(text);
  }catch{return false}
 }
 if (ext==='png') return at(0,'\x89PNG\r\n\x1a\n') && at(12,'IHDR');
 if (ext==='jpg') return at(0,'\xff\xd8\xff');
 if (ext==='webp') return at(0,'RIFF') && at(8,'WEBP');
 if (ext==='avif') return at(4,'ftyp') && (at(8,'avif')||at(8,'avis'));
 if (ext==='wav') return at(0,'RIFF') && at(8,'WAVE');
 if (ext==='mp3') return at(0,'ID3') || bytes[0]===255 && (bytes[1]&0xe6)===0xe2;
 if (ext==='ogg') return at(0,'OggS') && /OpusHead|vorbis/.test(bytes.subarray(0,512).toString('latin1'));
 if (ext==='m4a') return at(4,'ftyp') && at(8,'M4A ');
 if (ext==='lrc' && bytes.length<=512*1024) {
  try {
   const text = new TextDecoder('utf-8',{fatal:true}).decode(bytes);
   return !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text) && /^\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/m.test(text);
  } catch { return false }
 }
 return false;
}

export function prepareAsset(name,bytes) {
 if (typeof name!=='string' || !name.trim() || name.length>160 || /[/\\\x00-\x1f\x7f]/.test(name)) throw Error('Invalid asset filename');
 if (!bytes.length || bytes.length>assetLimit) throw Error('Expected 1 byte to 16 MiB');
 const suffix = name.includes('.') ? name.split('.').at(-1).toLowerCase() : '';
 const ext = suffix==='jpeg' ? 'jpg' : suffix;
 if (!formats.has(ext) || !matchesFormat(bytes,ext)) throw Error('Unsupported asset type or file does not match its extension');
 const id = createHash('sha256').update(bytes).digest('hex')+'.'+ext;
 return {id,name,mime:formats.get(ext),bytes:bytes.length,path:'/media/'+id};
}

export async function readAssetBody(request) {
 const declared = Number(request.headers['content-length']);
 if (declared>assetLimit) {request.resume();throw Error('Asset exceeds 16 MiB')}
 const chunks=[];
 let bytes=0;
 for await (const chunk of request.iterator({destroyOnReturn:false})) {
  bytes+=chunk.length;
  if (bytes>assetLimit) {request.resume();throw Error('Asset exceeds 16 MiB')}
  chunks.push(chunk);
 }
 return Buffer.concat(chunks,bytes);
}

export function createAssetStore(directory) {
 const blob = id => join(directory,id);
 const record = id => blob(id)+'.json';
 async function get(id) {
  try {return JSON.parse(await readFile(record(id),'utf8'))}
  catch (error) {if(error.code!=='ENOENT')throw error}
 }
 return {
  async list(){
   let names;
   try {names=await readdir(directory)}
   catch (error) {if(error.code==='ENOENT')return [];throw error}
   const assets=[];
   for (const name of names) {
    if (!name.endsWith('.json'))continue;
    const id=name.slice(0,-5);
    if (!isAssetId(id))continue;
    const entry=await get(id);
    if (entry)assets.push(entry);
   }
   return assets.sort((a,b)=>a.name.localeCompare(b.name,'zh-CN')||a.id.localeCompare(b.id));
  },
  async save(asset,bytes){
   const old=await get(asset.id);
   if(old)return old;
   await mkdir(directory,{recursive:true});
   const staged=record(asset.id)+'.'+randomUUID()+'.part';
   try {
    await writeFile(blob(asset.id),bytes);
    await writeFile(staged,JSON.stringify(asset),{flag:'wx'});
    await rename(staged,record(asset.id));
   }finally{await rm(staged,{force:true})}
   return asset;
  },
  async remove(id){
   if(!await get(id))return false;
   await rm(record(id));
   await rm(blob(id),{force:true});
   return true;
  },
  async read(id){
   if(!await get(id))return;
   return {bytes:await readFile(blob(id)),mime:formats.get(id.split('.').at(-1))};
  },
 };
}

export function usesAsset(value,id,prefix='') {
 if(typeof value==='string'){
  try{return new URL(value,'https://media.invalid').pathname===prefix+'/media/'+id}
  catch{return false}
 }
 return value!==null && typeof value==='object' && Object.values(value).some(item=>usesAsset(item,id,prefix));
}
