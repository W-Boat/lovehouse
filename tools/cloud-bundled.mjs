import {createReadStream} from 'node:fs';
import {readFile,realpath,stat} from 'node:fs/promises';
import {isAbsolute,relative,resolve,sep} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {fileURLToPath} from 'node:url';

const defaultDirectory=fileURLToPath(new URL('../public/',import.meta.url));
const defaultCatalog=new URL('../admin/bundled/catalog.json',import.meta.url);

export function createBundledCatalog({publicPrefix,directory=process.env.LOVEHOUSE_BUNDLED_PUBLIC_DIR||defaultDirectory,catalog=defaultCatalog}){
 let bundlePromise;
 const filePath=id=>publicPrefix+'/bundled/'+id.split('/').map(encodeURIComponent).join('/');
 async function load(){
  if(!bundlePromise){
   bundlePromise=readFile(catalog,'utf8').then(raw=>{
    const bundle=JSON.parse(raw);
    if(!bundle.baseline||!Array.isArray(bundle.assets))throw Error('Invalid bundled catalog');
    const assets=bundle.assets.map(asset=>({...asset,path:filePath(asset.id)}));
    return {baseline:bundle.baseline,assets,byId:new Map(assets.map(asset=>[asset.id,asset]))};
   }).catch(error=>{bundlePromise=undefined;throw error});
  }
  return bundlePromise;
 }
 async function serve(request,response,pathname){
  let id;
  try{id=decodeURIComponent(pathname.slice('/bundled/'.length))}catch{return false}
  const {byId}=await load();
  const asset=byId.get(id);
  if(!asset)return false;
  let path,info;
  try{
   const root=await realpath(directory);
   path=await realpath(resolve(root,id));
   const relativePath=relative(root,path);
   if(!relativePath||isAbsolute(relativePath)||relativePath==='..'||relativePath.startsWith('..'+sep))return false;
   info=await stat(path);
  }catch(error){if(error.code==='ENOENT')return false;throw error}
  if(!info.isFile())return false;
  const inline=/^(?:image\/(?:avif|bmp|gif|x-icon|jpeg|png|webp)|audio\/(?:mp4|mpeg|ogg|wav)|text\/plain; charset=utf-8)$/.test(asset.mime);
  let start=0,end=info.size-1,status=200;
  const headers={
   'Content-Type':inline?asset.mime:'application/octet-stream',
   'X-Content-Type-Options':'nosniff',
   'Content-Security-Policy':"default-src 'none'; sandbox",
   'Access-Control-Allow-Origin':'*',
   'Cache-Control':'public, max-age=300',
   'Accept-Ranges':'bytes',
  };
  if(!inline)headers['Content-Disposition']="attachment; filename*=UTF-8''"+encodeURIComponent(asset.name);
  if(request.headers.range){
   const range=/^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
   if(range?.[1]){
    start=Number(range[1]);
    if(range[2])end=Math.min(end,Number(range[2]));
   }else if(range?.[2])start=Math.max(0,info.size-Number(range[2]));
   else start=info.size;
   if(start>end||!Number.isSafeInteger(start)){
    response.writeHead(416,{'Content-Range':'bytes */'+info.size}).end();return true;
   }
   status=206;headers['Content-Range']='bytes '+start+'-'+end+'/'+info.size;
  }
  headers['Content-Length']=end-start+1;
  response.writeHead(status,headers);
  if(request.method==='HEAD'||info.size===0)response.end();
  else await pipeline(createReadStream(path,{start,end}),response);
  return true;
 }
 return {load,serve};
}
