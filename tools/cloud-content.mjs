import {validateGiftOverrides,validateAnnouncement} from '../content/cloud-gifts.mjs';
import {createBundledCatalog} from './cloud-bundled.mjs';
import {createAndroidUpdateStore} from './cloud-android-update.mjs';
import {createPackageStore,isPackagePlatform} from './cloud-packages.mjs';
import {validateCloudScenes} from '../content/cloud-scenes.mjs';
import {validatePortalUrl} from '../content/cloud-portal-url.mjs';
import {validateCloudInteractions,validateGiftGames} from '../content/cloud-interactions.mjs';
import {validateCloudMedia} from '../content/cloud-media.mjs';
import {validateCloudPlaylist} from '../content/cloud-playlist.mjs';
import {createHash, randomUUID, timingSafeEqual} from 'node:crypto';
import {createServer} from 'node:http';
import {mkdir, readFile, readdir, rename, rm, stat, writeFile} from 'node:fs/promises';
import {basename,join} from 'node:path';
import {createAssetStore,isAssetId,prepareAsset,readAssetBody,usesAsset,assetLimit} from './cloud-assets.mjs';
import {pathToFileURL} from 'node:url';

const limit = 1_000_000;
const builtInZones = new Set('room garden forest pier greenhouse memory station postoffice aquarium camp magic haunted cinema ferris mars hotspring market aurora shichahai gulou chaya tianmo tanghulu catcottage highschool musicroom'.split(' '));
const publishFields = new Set(['schema','revision','texts','portals','musicRoom','media','interactions','scenes','giftGames','gifts','announcement','notification']);
const jsonHeaders = {'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'};

function insideFloor([x,y],[[left,top],[right,bottom]]) {
 return x>=left && x<=right && y>=top && y<=bottom;
}

export function prepareSnapshot(input) {
 if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Expected a configuration object');
 for (const key of Object.keys(input)) if (!publishFields.has(key)) throw Error('Unknown configuration field: ' + key);
 const texts = input.texts ?? {};
 if (typeof texts !== 'object' || Array.isArray(texts) || Object.entries(texts).length > 4000) throw Error('Invalid texts');
 for (const [key,value] of Object.entries(texts)) {
  if (!/^[a-z0-9][a-z0-9.-]{0,180}$/i.test(key) || typeof value !== 'string' || value.length > 20000) throw Error('Invalid text key or value: ' + key);
 }
 const portals = input.portals ?? [];
 if (!Array.isArray(portals) || portals.length > 2) throw Error('Expected at most two portals');
 for (const portal of portals) {
  if (!portal || typeof portal.label !== 'string' || !portal.label.trim() || portal.label.length > 32) throw Error('Invalid portal label');
 }
 const scenes = validateCloudScenes(input.scenes);
 const sceneFloors = new Map();
 for (const scene of scenes ?? []) {
  if (!builtInZones.has(scene.parent)) throw Error('Unknown parent scene: ' + scene.parent);
  if (!insideFloor(scene.spawn,scene.floor) || !insideFloor(scene.exit,scene.floor)) throw Error('Spawn or exit outside floor: ' + scene.id);
  sceneFloors.set(scene.id,scene.floor);
 }
 const interactions = validateCloudInteractions(input.interactions);
 for (const item of interactions ?? []) {
  const floor = sceneFloors.get(item.zone);
  if (!floor && !builtInZones.has(item.zone)) throw Error('Unknown interaction scene: ' + item.zone);
  if (floor && !insideFloor(item.point,floor)) throw Error('Interaction point outside floor: ' + item.id);
 }
 const body = {
  schema: 1,
  texts: Object.fromEntries(Object.entries(texts).sort(([a],[b]) => a.localeCompare(b,'en'))),
  portals: portals.map(({label,url})=>({label,url:validatePortalUrl(url)})),
  musicRoom: validateCloudPlaylist(input.musicRoom),
  media: validateCloudMedia(input.media),
  interactions,
  scenes,
  giftGames: validateGiftGames(input.giftGames),
  gifts: validateGiftOverrides(input.gifts),
  announcement: validateAnnouncement(input.announcement),
  notification: validateAnnouncement(input.notification),
 };
 const revision = createHash('sha256').update(JSON.stringify(body)).digest('hex');
 const json = JSON.stringify({...body,revision});
 if (Buffer.byteLength(json) > limit) throw Error('Snapshot exceeds 1 MB');
 return {revision,json};
}

async function saveSnapshot(output,json) {
 const staged = output + '.' + randomUUID() + '.part';
 try {
  await writeFile(staged,json,{flag:'wx'});
  await rename(staged,output);
 } finally {
  await rm(staged,{force:true});
 }
}

const revisionPattern = /^[a-f0-9]{64}$/;

function validatedSnapshot(json) {
 const parsed=JSON.parse(json);
 const snapshot=prepareSnapshot(parsed);
 if(parsed.revision!==snapshot.revision)throw Error('Stored revision does not match its configuration');
 return snapshot;
}

async function readCurrent(file) {
 try { return validatedSnapshot(await readFile(file,'utf8')) }
 catch(error) { if(error.code==='ENOENT')return; throw error }
}

async function rememberRevision(file,snapshot) {
 const directory=file+'.history';
 await mkdir(directory,{recursive:true});
 const target=join(directory,snapshot.revision+'.json');
 try {
  const previous=validatedSnapshot(await readFile(target,'utf8'));
  if(previous.revision===snapshot.revision)return;
 }catch(error){if(error.code!=='ENOENT')throw error}
 await saveSnapshot(target,snapshot.json);
}

async function saveRelease(file,json) {
 const next=validatedSnapshot(json);
 const previous=await readCurrent(file);
 if(previous)await rememberRevision(file,previous);
 await rememberRevision(file,next);
 await saveSnapshot(file,next.json);
}

async function revisionHistory(file) {
 let names=[];
 try { names=await readdir(file+'.history') }
 catch(error){if(error.code!=='ENOENT')throw error}
 const revisions=[];
 for(const name of names){
  const revision=name.slice(0,-5);
  if(!name.endsWith('.json')||!revisionPattern.test(revision))continue;
  const path=join(file+'.history',name);
  const info=await stat(path);
  revisions.push({revision,createdAt:info.mtime.toISOString(),bytes:info.size,current:false});
 }
 const current=await readCurrent(file);
 if(current){
  const found=revisions.find(item=>item.revision===current.revision);
  if(found)found.current=true;
  else{
   const info=await stat(file);
   revisions.push({revision:current.revision,createdAt:info.mtime.toISOString(),bytes:info.size,current:true});
  }
 }
 return revisions.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.revision.localeCompare(b.revision));
}

function sendJson(response,status,body) {
 response.writeHead(status,jsonHeaders).end(JSON.stringify(body));
}

function authenticated(header,token) {
 if (!token || typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
 const supplied = Buffer.from(header.slice(7));
 const expected = Buffer.from(token);
 return supplied.length === expected.length && timingSafeEqual(supplied,expected);
}

async function readJson(request) {
 if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') throw Error('Expected application/json');
 const chunks = [];
 let bytes = 0;
 for await (const chunk of request.iterator({destroyOnReturn:false})) {
  bytes += chunk.length;
  if (bytes > limit) {
   request.resume();
   throw Error('Configuration exceeds 1 MB');
  }
  chunks.push(chunk);
 }
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const assetTypes = new Map([['html','text/html; charset=utf-8'],['js','text/javascript; charset=utf-8'],['css','text/css; charset=utf-8'],['svg','image/svg+xml'],['png','image/png'],['webp','image/webp'],['woff2','font/woff2']]);
const adminDir = new URL('../admin/dist/',import.meta.url);

export function createContentHandler({file,token,publicPrefix='',bundledDirectory,bundledCatalog}) {
 if(!/^(?:\/[a-zA-Z0-9_-]+)*$/.test(publicPrefix))throw Error('Invalid LOVEHOUSE_PUBLIC_PREFIX');
 const bundled=createBundledCatalog({publicPrefix,directory:bundledDirectory,catalog:bundledCatalog});
 const publicAsset=asset=>({...asset,path:publicPrefix+asset.path});
 const assets=createAssetStore(file+'.assets');
 const packages=createPackageStore(file+'.packages',publicPrefix);
 const androidUpdate=createAndroidUpdateStore(file+'.android-update');
 let pendingWrite=Promise.resolve();
 const serialize=operation=>{
  const result=pendingWrite.then(operation);
  pendingWrite=result.catch(()=>{});
  return result;
 };
 const publish=(json,expected)=>serialize(async ()=>{
   if (expected !== undefined) {
    let current='';
    try { current=JSON.parse(await readFile(file,'utf8')).revision }
    catch (error) { if (error.code!=='ENOENT') throw error }
    if (expected!==`"${current}"`) return false;
   }
   await saveRelease(file,json);
   return true;
 });
 return async (request,response)=>{
  let url;
  try { url = new URL(request.url,'http://localhost') }
  catch { sendJson(response,400,{error:'Invalid request URL'}); return }
  const {pathname} = url;
  if(pathname.startsWith('/android-update/')&&['GET','HEAD'].includes(request.method)){
   try{
    if(!await androidUpdate.serve(request,response,pathname.slice('/android-update/'.length)))sendJson(response,404,{error:'No update available'});
   }catch{if(!response.headersSent)sendJson(response,500,{error:'Unable to serve Android update'})}
   return;
  }
  if(request.method==='GET'&&pathname==='/packages.json'){
   try{response.writeHead(200,{...jsonHeaders,'Access-Control-Allow-Origin':'*'}).end(JSON.stringify(await packages.list()))}
   catch{sendJson(response,500,{error:'Unable to read package releases'})}
   return;
  }
  if(pathname.startsWith('/packages/')&&['GET','HEAD'].includes(request.method)){
   try{if(!await packages.serve(request,response,pathname))sendJson(response,404,{error:'Package not found'})}
   catch{if(!response.headersSent)sendJson(response,500,{error:'Unable to download package'})}
   return;
  }
  if(pathname.startsWith('/bundled/')&&['GET','HEAD'].includes(request.method)){
   try{if(!await bundled.serve(request,response,pathname))sendJson(response,404,{error:'Bundled asset not found'})}
   catch{if(!response.headersSent)sendJson(response,404,{error:'Bundled assets unavailable'})}
   return;
  }
  if (request.method==='GET' && pathname==='/content.json') {
   const headers = {...jsonHeaders,'Access-Control-Allow-Origin':'*','Cache-Control':'no-cache'};
   try {
    const json = await readFile(file,'utf8');
    const {revision} = JSON.parse(json);
    const etag = '"' + revision + '"';
    if (url.searchParams.get('revision')===revision || request.headers['if-none-match']===etag) {
     response.writeHead(304,{...headers,ETag:etag}).end();
    } else response.writeHead(200,{...headers,ETag:etag}).end(json);
   } catch {
    response.writeHead(503,headers).end();
   }
   return;
  }
  if ((request.method==='GET'||request.method==='HEAD') && pathname.startsWith('/media/')) {
   const id=pathname.slice('/media/'.length);
   if(isAssetId(id)){
    try {
     const data=await assets.read(id);
     if(data){
      const total=data.bytes.length;
      const headers={
       'Content-Type':data.mime,'Cache-Control':'public, max-age=300','Accept-Ranges':'bytes',
       'Access-Control-Allow-Origin':'*','X-Content-Type-Options':'nosniff',
       'Content-Security-Policy':"default-src 'none'; sandbox",
      };
      const range=request.headers.range;
      let body=data.bytes,status=200;
      if(range!==undefined){
       const match=/^bytes=(\d*)-(\d*)$/.exec(range);
       const start=match?.[1]?Number(match[1]):Math.max(0,total-Number(match?.[2]));
       const end=match?.[1]&&match[2]?Math.min(total-1,Number(match[2])):total-1;
       if(!match||(!match[1]&&!match[2])||!Number.isSafeInteger(start)||start>end||start>=total){
        response.writeHead(416,{...headers,'Content-Range':'bytes */'+total}).end();
        return;
       }
       body=body.subarray(start,end+1);
       headers['Content-Range']='bytes '+start+'-'+end+'/'+total;
       status=206;
      }
      response.writeHead(status,{...headers,'Content-Length':body.length}).end(request.method==='HEAD'?undefined:body);
      return;
     }
    } catch(error) {if(error.code!=='ENOENT'){sendJson(response,500,{error:'Unable to read asset'});return}}
   }
   sendJson(response,404,{error:'Asset not found'});
   return;
  }
  if (pathname.startsWith('/admin/api/')) {
   if (!token) { sendJson(response,503,{error:'Publisher authentication is not configured'}); return }
   if (!authenticated(request.headers.authorization,token)) { sendJson(response,401,{error:'Invalid publisher token'}); return }
   if(pathname.startsWith('/admin/api/android-update/')&&request.method==='POST'){
    const target=pathname.slice('/admin/api/android-update/'.length);
    try{
     if(target==='publish')sendJson(response,201,{version:await androidUpdate.publish(request,serialize)});
     else if(target.startsWith('blobs/')){
      await androidUpdate.saveBlob(target.slice(6),request);
      sendJson(response,201,{stored:true});
     }else sendJson(response,404,{error:'Unknown Android update operation'});
    }catch(error){sendJson(response,400,{error:error.message})}
    return;
   }
   if(pathname==='/admin/api/packages'&&request.method==='GET'){
    try{sendJson(response,200,{releases:await packages.history()})}
    catch{sendJson(response,500,{error:'Unable to read package history'})}
    return;
   }
   if(pathname==='/admin/api/packages/select'&&request.method==='POST'){
    try{
     const {platform,path,expected}=await readJson(request);
     if(!isPackagePlatform(platform)||typeof path!=='string'||!(expected===null||typeof expected==='string'))
      throw Error('Invalid package selection');
     const result=await serialize(()=>packages.select(platform,path,expected));
     if(result.conflict)sendJson(response,412,{error:'当前安装包已变化，请刷新列表'});
     else if(!result.entry)sendJson(response,404,{error:'找不到该安装包版本'});
     else sendJson(response,200,result.entry);
    }catch(error){sendJson(response,400,{error:error.message})}
    return;
   }
   if(pathname==='/admin/api/packages'&&request.method==='POST'){
    const platform=url.searchParams.get('platform');
    if(!isPackagePlatform(platform)){sendJson(response,400,{error:'Invalid package platform'});return}
    try{
     const entry=await packages.save(platform,url.searchParams.get('version')??'',request,serialize);
     sendJson(response,201,entry);
    }catch(error){sendJson(response,400,{error:error.message})}
    return;
   }
   if(pathname==='/admin/api/bundled'&&request.method==='GET'){
    try{const {baseline,assets}=await bundled.load();sendJson(response,200,{baseline,assets})}
    catch{sendJson(response,503,{error:'Bundled catalog unavailable'})}
    return;
   }
   if (pathname==='/admin/api/history' && request.method==='GET') {
    try { sendJson(response,200,{revisions:await revisionHistory(file)}) }
    catch { sendJson(response,500,{error:'Unable to read revision history'}) }
    return;
   }
   if (pathname.startsWith('/admin/api/history/') && request.method==='GET') {
    const revision=pathname.slice('/admin/api/history/'.length);
    if(!revisionPattern.test(revision)){sendJson(response,404,{error:'Revision not found'});return}
    try{
     const current=await readCurrent(file);
     const snapshot=current?.revision===revision?current:validatedSnapshot(await readFile(join(file+'.history',revision+'.json'),'utf8'));
     if(snapshot.revision!==revision)throw Error('Revision history is corrupted');
     sendJson(response,200,JSON.parse(snapshot.json));
    }catch(error){sendJson(response,error.code==='ENOENT'?404:500,{error:error.code==='ENOENT'?'Revision not found':'Unable to read revision'})}
    return;
   }
   if (pathname==='/admin/api/rollback' && request.method==='POST') {
    const expected=request.headers['if-match'];
    if(expected===undefined){sendJson(response,428,{error:'Rollback requires If-Match with the current revision'});return}
    if(typeof expected!=='string'||!/^"(?:[a-f0-9]{64})?"$/.test(expected)){
     sendJson(response,400,{error:'Invalid expected revision'});return;
    }
    let revision;
    try{
     const input=await readJson(request);
     if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==1||!revisionPattern.test(input.revision))throw Error('Expected a revision');
     revision=input.revision;
    }catch(error){sendJson(response,400,{error:error.message});return}
    try{
     const result=await serialize(async()=>{
      const current=await readCurrent(file);
      if(expected!==JSON.stringify(current?.revision??''))return 412;
      if(current?.revision===revision)return 200;
      let target;
      try{target=validatedSnapshot(await readFile(join(file+'.history',revision+'.json'),'utf8'))}
      catch(error){if(error.code==='ENOENT')return 404;throw error}
      if(target.revision!==revision)throw Error('Revision history is corrupted');
      await saveRelease(file,target.json);
      return 200;
     });
     sendJson(response,result,result===200?{revision}:{error:result===412?'The published configuration changed. Reload it before rolling back.':'Revision not found'});
    }catch{sendJson(response,500,{error:'Unable to restore revision'})}
    return;
   }
   if (pathname==='/admin/api/assets' && request.method==='GET') {
    try {sendJson(response,200,{assets:(await assets.list()).map(publicAsset)})}
    catch {sendJson(response,500,{error:'Unable to list assets'})}
    return;
   }
   if (pathname==='/admin/api/assets' && request.method==='POST') {
    let data,asset;
    try {
     const name=decodeURIComponent(request.headers['x-asset-name']??'');
     data=await readAssetBody(request);
     asset=prepareAsset(name,data);
    } catch(error) {sendJson(response,400,{error:error.message});return}
    try {sendJson(response,201,{asset:publicAsset(await serialize(()=>assets.save(asset,data)))})}
    catch {sendJson(response,500,{error:'Unable to store asset'})}
    return;
   }
   const referenceMatch=/^\/admin\/api\/assets\/([^/]+)\/references$/.exec(pathname);
   if(referenceMatch && request.method==='GET'){
    const id=referenceMatch[1];
    if(!isAssetId(id)){sendJson(response,404,{error:'Asset not found'});return}
    try{
     const references=[];
     const collect=(value,path,revision,current)=>{
      if(typeof value==='string'){
       if(usesAsset(value,id,publicPrefix))references.push({path,revision,current});
      }else if(value&&typeof value==='object'){
       for(const [key,item] of Object.entries(value))collect(item,path+'/'+key.replace(/~/g,'~0').replace(/\//g,'~1'),revision,current);
      }
     };
     const current=await readCurrent(file);
     if(current)collect(JSON.parse(current.json),'',current.revision,true);
     for(const item of await revisionHistory(file)){
      if(item.revision===current?.revision)continue;
      const snapshot=validatedSnapshot(await readFile(join(file+'.history',item.revision+'.json'),'utf8'));
      collect(JSON.parse(snapshot.json),'',item.revision,false);
     }
     sendJson(response,200,{references});
    }catch{sendJson(response,500,{error:'Unable to inspect asset references'})}
    return;
   }
   if (pathname.startsWith('/admin/api/assets/') && request.method==='DELETE') {
    const id=pathname.slice('/admin/api/assets/'.length);
    if (!isAssetId(id)) {sendJson(response,404,{error:'Asset not found'});return}
    try {
     const status=await serialize(async ()=>{
      let snapshot;
      try {snapshot=JSON.parse(await readFile(file,'utf8'))}
      catch(error) {if(error.code!=='ENOENT')throw error}
      if(usesAsset(snapshot,id,publicPrefix))return 409;
      for(const revision of await revisionHistory(file)){
       if(revision.current)continue;
       const stored=validatedSnapshot(await readFile(join(file+'.history',revision.revision+'.json'),'utf8'));
       if(usesAsset(JSON.parse(stored.json),id,publicPrefix))return 409;
      }
      return await assets.remove(id)?200:404;
     });
     sendJson(response,status,status===200?{deleted:id}:{error:status===409?'Asset is still used by a published or retained revision':'Asset not found'});
    } catch {sendJson(response,500,{error:'Unable to remove asset'})}
    return;
   }
   if (request.method==='GET' && pathname==='/admin/api/snapshot') {
    try { sendJson(response,200,JSON.parse(await readFile(file,'utf8'))) }
    catch (error) {
     if (error.code==='ENOENT') sendJson(response,200,{});
     else sendJson(response,500,{error:'Unable to read current snapshot'});
    }
    return;
   }
   if (request.method==='POST' && ['/admin/api/check','/admin/api/publish'].includes(pathname)) {
    let snapshot;
    try { snapshot = prepareSnapshot(await readJson(request)) }
    catch (error) { sendJson(response,400,{error:error.message}); return }
    if (pathname.endsWith('/publish')) {
     const expected=request.headers['if-match'];
     if (expected!==undefined && !/^"(?:[a-f0-9]{64})?"$/.test(expected)) {
      sendJson(response,400,{error:'Invalid expected revision'});
      return;
     }
     try {
      if (!await publish(snapshot.json,expected)) {
       sendJson(response,412,{error:'The published configuration changed. Reload it before publishing again.'});
       return;
      }
     }
     catch { sendJson(response,500,{error:'Unable to save snapshot'}); return }
    }
    sendJson(response,200,{revision:snapshot.revision});
    return;
   }
  }
  if (request.method==='GET' && pathname==='/admin') {
   response.writeHead(308,{Location:'/admin/'}).end();
   return;
  }
  if (request.method==='GET' && (pathname==='/admin/' || /^\/admin\/assets\/[\w.-]+$/.test(pathname))) {
   const asset = pathname==='/admin/' ? 'index.html' : pathname.slice('/admin/'.length);
   const mime = assetTypes.get(asset.split('.').at(-1));
   if (mime) {
    try {
     const contents = await readFile(new URL(asset,adminDir));
     response.writeHead(200,{
      'Content-Type':mime,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
      'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: https:; media-src 'self' https:; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
     }).end(contents);
     return;
    } catch {}
   }
  }
  sendJson(response,404,{error:'Not found'});
 };
}

async function main([command,file='content.json',output='content.json',expected]) {
 if (command==='check' || command==='publish') {
  const snapshot = prepareSnapshot(JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,'')));
  if (command==='publish') await saveRelease(output,snapshot.json);
  console.log(JSON.stringify(command==='publish'?{revision:snapshot.revision,output}:{revision:snapshot.revision}));
 } else if (command==='pull' || command==='push') {
  const token=process.env.LOVEHOUSE_ADMIN_TOKEN;
  if(!token)throw Error('Set LOVEHOUSE_ADMIN_TOKEN');
  const base=new URL(validatePortalUrl(command==='pull'?file:output));
  if(base.search||base.hash)throw Error('Publisher address must be a base URL');
  base.pathname=base.pathname.replace(/\/?$/,'/');
  const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
  let body;
  if(command==='push'){
   if(expected!=='new'&&!/^[a-f0-9]{64}$/.test(expected??''))throw Error('Pass expected current revision, or new for initial publication');
   body=prepareSnapshot(JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''))).json;
   headers['If-Match']=JSON.stringify(expected==='new'?'':expected);
  }
  const response=await fetch(new URL('admin/api/'+(command==='pull'?'snapshot':'publish'),base),{
   method:command==='pull'?'GET':'POST',headers,body,redirect:'error',signal:AbortSignal.timeout(15000),
  });
  const data=await response.json();
  if(!response.ok)throw Error('HTTP '+response.status+': '+(data.error??'Publisher request failed'));
  if(command==='pull'){
   if(Object.keys(data).length){const checked=prepareSnapshot(data);if(checked.revision!==data.revision)throw Error('Snapshot checksum mismatch')}
   await saveSnapshot(output,JSON.stringify(data,null,2));
   console.log(JSON.stringify({output,revision:data.revision??''}));
  }else console.log(JSON.stringify({revision:data.revision}));
 } else if (command==='history') {
  console.log(JSON.stringify({revisions:await revisionHistory(file)}));
 } else if (command==='upload') {
  const token=process.env.LOVEHOUSE_ADMIN_TOKEN;
  if(!token)throw Error('Set LOVEHOUSE_ADMIN_TOKEN before uploading');
  const base=new URL(validatePortalUrl(output));
  if(base.search||base.hash)throw Error('Publisher address must be a base URL');
  base.pathname=base.pathname.replace(/\/?$/,'/');
  const name=basename(file);
  const info=await stat(file);
  if(!info.isFile()||info.size>assetLimit)throw Error('Expected a file up to 16 MiB');
  const bytes=await readFile(file);
  const expected=prepareAsset(name,bytes);
  const response=await fetch(new URL('admin/api/assets',base),{
   method:'POST',redirect:'error',signal:AbortSignal.timeout(90_000),headers:{Authorization:'Bearer '+token,'X-Asset-Name':encodeURIComponent(name)},body:bytes,
  });
  const data=await response.json();
  if(!response.ok)throw Error(data.error??'Asset upload failed');
  if(data.asset?.id!==expected.id||data.asset.path!==new URL(expected.path.slice(1),base).pathname)throw Error('Unexpected asset upload response');
  console.log(JSON.stringify({asset:{...data.asset,url:new URL(data.asset.path,base).href}}));
 } else if (command==='serve') {
  const port = Number(process.env.PORT || 8789);
  const host = process.env.HOST || '127.0.0.1';
  createServer(createContentHandler({file,token:process.env.LOVEHOUSE_ADMIN_TOKEN,publicPrefix:process.env.LOVEHOUSE_PUBLIC_PREFIX})).listen(port,host,()=>console.log(JSON.stringify({host,port,path:'/content.json'})));
 } else throw Error('Usage: node tools/cloud-content.mjs check INPUT | publish INPUT OUTPUT | serve SNAPSHOT | history SNAPSHOT | upload FILE HTTPS_ORIGIN | pull HTTPS_BASE OUTPUT | push INPUT HTTPS_BASE EXPECTED_REVISION');
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url) {
 try { await main(process.argv.slice(2)) }
 catch (error) { console.error(JSON.stringify({error:error.message})); process.exitCode=2 }
}
