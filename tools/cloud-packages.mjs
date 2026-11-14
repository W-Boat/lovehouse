import {createHash,randomUUID} from 'node:crypto';
import {createWriteStream} from 'node:fs';
import {mkdir,readFile,readdir,rename,rm,writeFile} from 'node:fs/promises';
import {createBlobStore} from './cloud-blob-storage.mjs';
import {join} from 'node:path';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';

const formats={
 android:{extension:'apk',mime:'application/vnd.android.package-archive'},
 windows:{extension:'zip',mime:'application/zip'},
};
export const packageLimit=600*1024*1024;
export const isPackagePlatform=value=>Object.hasOwn(formats,value);

export function createPackageStore(directory,publicPrefix,bucket,rules){
 const blobs=createBlobStore('packages',bucket,rules);
 const manifest=join(directory,'packages.json');
 async function list(){
  try{return JSON.parse(await readFile(manifest,'utf8'))}
  catch(error){if(error.code==='ENOENT')return {};throw error}
 }
 const releaseName=(platform,version)=>'lovehouse-'+platform+'-'+version+'.'+formats[platform].extension;
 const releasePath=entry=>join(directory,entry.platform+'-'+entry.sha256+'-'+entry.version+'.json');
 async function history(){
  const current=await list();
  let files;
  try{files=await readdir(directory)}catch(error){if(error.code==='ENOENT')return [];throw error}
  const records=await Promise.all(files.filter(name=>/^(android|windows)-[a-f0-9]{64}-[A-Za-z0-9._-]+\.json$/.test(name))
    .map(async name=>JSON.parse(await readFile(join(directory,name),'utf8'))));
  for(const entry of Object.values(current))if(!records.some(row=>row.path===entry.path))records.push(entry);
  return records.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).map(entry=>({...entry,current:current[entry.platform]?.path===entry.path}));
 }
 async function writeCatalog(catalog){
  const staged=manifest+'.'+randomUUID()+'.part';
  try{await writeFile(staged,JSON.stringify(catalog),{flag:'wx'});await rename(staged,manifest)}
  finally{await rm(staged,{force:true})}
 }
 async function select(platform,path,expected){
  const current=await list();
  if((current[platform]?.path??null)!==expected)return {conflict:true};
  const entry=(await history()).find(row=>row.platform===platform&&row.path===path);
  if(!entry)return {};
  delete entry.current;
  const id=entry.sha256+'.'+formats[platform].extension;
  if(await blobs.size(id,join(directory,id))!==entry.bytes)return {};
  await writeCatalog({...current,[platform]:entry});
  return {entry};
 }
 async function save(platform,version,request,serialize){
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(version))throw Error('Invalid package version');
  if(Number(request.headers['content-length'])>packageLimit)throw Error('Package exceeds 600 MiB');
  const format=formats[platform];
  await mkdir(directory,{recursive:true});
  const temporary=join(directory,randomUUID()+'.part');
  const hash=createHash('sha256');
  let bytes=0;
  let header=Buffer.alloc(0);
  const meter=new Transform({transform(chunk,encoding,callback){
   bytes+=chunk.length;
   if(bytes>packageLimit){callback(Error('Package exceeds 600 MiB'));return}
   if(header.length<4)header=Buffer.concat([header,chunk.subarray(0,4-header.length)]);
   hash.update(chunk);
   callback(null,chunk);
  }});
  try{
   await pipeline(request.iterator({destroyOnReturn:false}),meter,createWriteStream(temporary,{flags:'wx'}));
   if(header.toString('hex')!=='504b0304')throw Error('Expected an APK or ZIP archive');
   const sha256=hash.digest('hex');
   const id=sha256+'.'+format.extension;
   await blobs.putFile(id,join(directory,id),temporary,bytes,format.mime);
   return await register(platform,version,sha256,bytes,serialize);
  }finally{await rm(temporary,{force:true})}
 }
 async function register(platform,version,sha256,bytes,serialize){
  await mkdir(directory,{recursive:true});
  return serialize(async()=>{
    const previous=await list();
    const name=releaseName(platform,version);
    const entry={platform,version,name,bytes,sha256,publishedAt:new Date().toISOString(),
     path:publicPrefix+'/packages/'+sha256+'/'+name};
    if(previous[platform])await writeFile(releasePath(previous[platform]),JSON.stringify(previous[platform]));
    await writeFile(releasePath(entry),JSON.stringify(entry));
    await writeCatalog({...previous,[platform]:entry});
    return entry;
  });
 }
 async function direct(action,{platform,version,sha256,bytes},serialize){
  if(!isPackagePlatform(platform)||typeof version!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(version)||
     typeof sha256!=='string'||!/^[a-f0-9]{64}$/.test(sha256)||!Number.isSafeInteger(bytes)||bytes<4||bytes>packageLimit)
   throw Error('Invalid package metadata');
  const active=typeof bucket==='function'?await bucket():bucket;
  if(!active)throw Error('Storage bucket is not enabled');
  const format=formats[platform],key=active.key('packages',sha256+'.'+format.extension);
  if(action==='prepare'){
   if(await active.size(key)===bytes)return {exists:true};
   return {url:await active.signUpload(key,bytes,format.mime,sha256),contentType:format.mime};
  }
  if(await active.size(key)!==bytes)throw Error('Bucket file size mismatch');
  const digest=createHash('sha256');
  let received=0,header=Buffer.alloc(0);
  for await(const chunk of await active.stream(key)){
   if(header.length<4)header=Buffer.concat([header,chunk.subarray(0,4-header.length)]);
   received+=chunk.length;
   if(received>bytes)throw Error('Bucket file size mismatch');
   digest.update(chunk);
  }
  if(received!==bytes||digest.digest('hex')!==sha256||header.toString('hex')!=='504b0304')throw Error('Bucket package verification failed');
  return register(platform,version,sha256,bytes,serialize);
 }
 async function serve(request,response,pathname){
  const match=/^\/packages\/([a-f0-9]{64})\/(lovehouse-(android|windows)-[A-Za-z0-9._-]+\.(apk|zip))$/.exec(pathname);
  if(!match)return false;
  const [,sha256,name,platform,extension]=match;
  const format=formats[platform];
  if(format.extension!==extension)return false;
  const id=sha256+'.'+extension,blob=join(directory,id);
  const size=await blobs.size(id,blob);
  if(size===undefined)return false;
  let start=0,end=size-1,status=200;
  const headers={'Content-Type':format.mime,'Content-Disposition':'attachment; filename="'+name+'"',
   'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=86400','Accept-Ranges':'bytes'};
  if(request.headers.range){
   const range=/^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
   if(range?.[1]){start=Number(range[1]);if(range[2])end=Math.min(end,Number(range[2]))}
   else if(range?.[2])start=Math.max(0,info.size-Number(range[2]));
   else start=size;
   if(start>end||!Number.isSafeInteger(start)){
    response.writeHead(416,{'Content-Range':'bytes */'+size}).end();return true;
   }
   status=206;headers['Content-Range']='bytes '+start+'-'+end+'/'+size;
  }
  headers['Content-Length']=end-start+1;
  let body;
  try{if(request.method!=='HEAD')body=await blobs.stream(id,blob,size,status===206?{start,end}:undefined)}
  catch(error){if(error.code==='ENOENT')return false;throw error}
  response.writeHead(status,headers);
  if(body)await pipeline(body,response);
  else response.end();
  return true;
 }
 return {list,history,select,save,serve,direct};
}
