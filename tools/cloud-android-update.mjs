import {createHash,randomUUID,verify,X509Certificate} from 'node:crypto';
import {createReadStream,createWriteStream} from 'node:fs';
import {mkdir,readFile,rename,rm,stat,writeFile} from 'node:fs/promises';
import {createBlobStore} from './cloud-blob-storage.mjs';
import {join} from 'node:path';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';

const signingCertificate=new X509Certificate(`-----BEGIN CERTIFICATE-----
MIID+DCCAmCgAwIBAgIUWUxO96F1vBhNHgDY1pHXfv5juOgwDQYJKoZIhvcNAQEL
BQAwNTEiMCAGA1UEAwwZTG92ZWhvdXNlIEFuZHJvaWQgUmVsZWFzZTEPMA0GA1UE
CgwGVy1Cb2F0MCAXDTI2MTExMjA5MTMyM1oYDzIxMjYxMDIwMDkxMzIzWjA1MSIw
IAYDVQQDDBlMb3ZlaG91c2UgQW5kcm9pZCBSZWxlYXNlMQ8wDQYDVQQKDAZXLUJv
YXQwggGiMA0GCSqGSIb3DQEBAQUAA4IBjwAwggGKAoIBgQC0yexUVq6HuGe6B/Ot
b5tL70VjyDyhduQdTx894LNH2h1Q2NwScfyLcw8SSMckxijWWl/hL5l3z7YrBjXZ
Blz0KocRuIqIBfHnA3aV6+1tws5LXGF60JhvCKU927BJI4hIyM8tyyo4OCECOSqx
v/yGQBcHAzAAqsyyz/WbrVONmnWaGOMZqMYikZIHg4rREN+siKUlBCNsMOHelQAn
CyCbty/67muR2uOxLlBvzuANSXfpFjapus0OZ1t08OEn9yR7OH5zundLi/BbcCAW
hUFnv7uvAS3U49uP/n5i4Qi+xQlIGyDAbYBT+xq7zwhVm8qZbGxvwqM29t1yP+7I
gaR4ZEfrDmohJukXUtowp5Q2idRY4JFTZ+65GdS5LhkHQ7zwe7lon06m+4HXASpp
OLlfmhGPrRRt15Q7pM+EjVQPueLC+/iSDHolNQPs4nyYj85AR5BK44FvfL/fDGjP
9tF81HtN8SmAbsYRYAYfUzhCaEy4n9NHk78XR4JOcO4jq08CAwEAATANBgkqhkiG
9w0BAQsFAAOCAYEAiPrT2YZNfcfKSXvLyOLPGwG04TCdWU8yxzar1fVcnbxlaaP4
ne3c0uiGZAHlA6YOr2MfJz7vo5k6HdaRzsCpwSn4+k0qRgWgTdPUqX/INZakfWjm
9ERWfSoZhG1AHbgM7cMiMfw7GziyRKhNSozKjw0nrJT7wClDfEscPEeHbgsT9XE7
xr44cBJR756U4EPhNP9wW2acBTPujGYSdH6AdW2nkijVMyEIVc/pmyYSj62i/W1T
kUgNGapPpK2B3TiVMIjHr5vnEfsDCjEc3zZXYNQ3yER7dKz1Y7t5IM8DaVv18/tr
uOOawwKZ1/m7jPTOyvHRuz4Ycpv6rilpkrco8lFX1WNgxKK1agyeQq92lVlN+Zn0
2S4fDfnfgwzHbrozAC+gZhdNHMg7TYWpGKNTq0L6YAb6uYZ1LncEhuti7hgD+GQU
wYLnU64h0YIlvyW8oU69N0vJ+zAC+XgJzJw9LkZ+zarsIOzSV0MyPxAYz9UcdYe+
0vRhzPGAjCnKQrwa
-----END CERTIFICATE-----`);
const digestPattern=/^[a-f0-9]{64}$/;
const fileLimit=200_000_000;
const manifestLimit=3_000_000;
export function createAndroidUpdateStore(directory,bucket,rules){
 const storage=createBlobStore('android-update/blobs',bucket,rules);
 const blobs=join(directory,'blobs');
 const current=join(directory,'update.json');
 async function saveBlob(hash,request){
  if(!digestPattern.test(hash))throw Error('无效资源哈希');
  await mkdir(blobs,{recursive:true});
  const target=join(blobs,hash),temporary=target+'.'+randomUUID()+'.part';
  const digest=createHash('sha256');
  let bytes=0;
  const meter=new Transform({transform(chunk,encoding,done){
   bytes+=chunk.length;
   if(bytes>fileLimit){done(Error('单个资源超过 200 MB'));return}
   digest.update(chunk);done(null,chunk);
  }});
  try{
   await pipeline(request.iterator({destroyOnReturn:false}),meter,createWriteStream(temporary,{flags:'wx'}));
   if(digest.digest('hex')!==hash)throw Error('资源 SHA-256 不匹配');
   await storage.putFile(hash,target,temporary,bytes,'application/octet-stream');
  }finally{await rm(temporary,{force:true})}
 }
 function payload(envelope){
  if(typeof envelope?.payload!=='string'||typeof envelope.signature!=='string'||!envelope.signature)throw Error('需要 Actions 生成的签名清单');
  const signed=Buffer.from(envelope.payload,'base64');
  if(!verify('RSA-SHA256',signed,signingCertificate.publicKey,Buffer.from(envelope.signature,'base64')))
   throw Error('资源清单签名与 Android 正式版不匹配');
  const data=JSON.parse(signed.toString('utf8'));
  if(data.certificateSha256!==signingCertificate.fingerprint256.replaceAll(':','').toLowerCase()||data.format!==1||data.requiredNativeApi!==1||data.entry!=='index.html'||data.blobDirectory!=='blobs/'||
     data.archive!=='lovehouse-content.zip'||!Number.isSafeInteger(data.version)||data.version<1||data.version>2147483647||
     !Number.isSafeInteger(data.archiveBytes)||data.archiveBytes<1||data.archiveBytes>300_000_000||
     !data.files?.['index.html']||Object.keys(data.files).length>4096)throw Error('清单版本或资源列表无效');
  return data;
 }
 async function publish(request,serialize){
  const chunks=[];
  let bytes=0;
  for await(const chunk of request.iterator({destroyOnReturn:false})){
   bytes+=chunk.length;
   if(bytes>manifestLimit)throw Error('签名清单超过 3 MB');
   chunks.push(chunk);
  }
  const envelope=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const data=payload(envelope);
  let total=0;
  for(const [name,file] of Object.entries(data.files)){
   if(name.includes('\\')||name.includes(':')||name.split('/').some(part=>!part||part.startsWith('.'))||
      !file||typeof file.sha256!=='string'||!digestPattern.test(file.sha256)||!Number.isSafeInteger(file.bytes)||file.bytes<0||file.bytes>fileLimit||
      (total+=file.bytes)>700_000_000)throw Error('无效资源条目 '+name);
   const size=await storage.size(file.sha256,join(blobs,file.sha256));
   if(size!==file.bytes)throw Error('资源缺失或大小不匹配 '+name);
  }
  return serialize(async()=>{
   let old;
   try{old=payload(JSON.parse(await readFile(current,'utf8')))}
   catch(error){if(error.code!=='ENOENT')throw error}
   if(old&&old.version>=data.version)throw Error('资源版本必须高于当前版本');
   const temporary=current+'.'+randomUUID()+'.part';
   try{await writeFile(temporary,JSON.stringify(envelope),{flag:'wx'});await rename(temporary,current)}
   finally{await rm(temporary,{force:true})}
   return data.version;
  });
 }
 async function serve(request,response,path){
  const hash=path.match(/^blobs\/([a-f0-9]{64})$/)?.[1];
  const target=hash?join(blobs,hash):path==='update.json'?current:null;
  if(!target)return false;
  const size=hash?await storage.size(hash,target):await stat(target).then(info=>info.size).catch(error=>{if(error.code!=='ENOENT')throw error});
  if(size===undefined)return false;
  if(hash){
   const location=await storage.downloadUrl(hash,target,size,hash,'application/octet-stream',{head:request.method==='HEAD'});
   if(location){
    response.writeHead(302,{Location:location,'Cache-Control':'private, no-store',
     'Access-Control-Allow-Origin':'*','Referrer-Policy':'no-referrer','Content-Length':'0'}).end();
    return true;
   }
  }
  const body=request.method==='HEAD'?undefined:hash?await storage.stream(hash,target,size):createReadStream(target);
  response.writeHead(200,{'Content-Type':hash?'application/octet-stream':'application/json',
   'Content-Length':size,'Cache-Control':hash?'public, max-age=31536000, immutable':'no-store',
   'X-Content-Type-Options':'nosniff'});
  if(body)await pipeline(body,response);
  else response.end();
  return true;
 }
 return {saveBlob,publish,serve};
}
