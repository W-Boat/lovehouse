import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
// @ts-ignore Publisher module.
import {createContentHandler} from './cloud-content.mjs';
// @ts-ignore Publisher module.
import {createAndroidUpdateStore} from './cloud-android-update.mjs';
// @ts-ignore Publisher module.
import {defaultStorageRules} from './cloud-blob-storage.mjs';

function response(){
 const result={status:0,headers:{} as Record<string,string>,body:''};
 const sink={writeHead(status:number,headers:Record<string,string>){Object.assign(result,{status,headers});return sink},end(body=''){result.body=body;return sink}};
 return {result,sink};
}
test('all cloud media formats redirect without reading bucket contents, and missing assets stay 404',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'lovehouse-media-signed-'));
 try{
  const file=join(directory,'content.json');
  await writeFile(file+'.storage.json',JSON.stringify({...defaultStorageRules,thresholdBytes:0}));
  const objects=new Map<string,number>(),calls:any[]=[];
  const bucket={key:(group:string,id:string)=>group+'/'+id,
   put:async(key:string,bytes:Buffer)=>{objects.set(key,bytes.length)},
   size:async(key:string)=>objects.get(key),
   signDownload:async(...args:any[])=>{calls.push(args);return 'https://bucket.example/media?temporary=signature'},
   stream:async()=>{throw Error('Media must not proxy bucket bytes')},
  };
  const handler=createContentHandler({file,token:'fixture-token',bucket});
  async function request(method:string,url:string,headers={},body=''){
   const input=Object.assign(Readable.from([Buffer.from(body)]),{method,url,headers,socket:{remoteAddress:'127.0.0.1'}});
   const {result,sink}=response();await handler(input,sink);return result;
  }
  for(const [name,body] of [['scene.json','{"scene":"new"}'],['movie.html','<!doctype html><p>Hello</p>'],['lyrics.lrc','[00:01]Hello']]){
   const upload=await request('POST','/admin/api/assets',{'authorization':'Bearer fixture-token','x-asset-name':name},body);
   assert.equal(upload.status,201);
   const {asset}=JSON.parse(upload.body);
   for(const method of ['GET','HEAD']){
    const result=await request(method,asset.path,{range:'bytes=0-3'});
    assert.equal(result.status,302);
    assert.equal(result.headers.Location,'https://bucket.example/media?temporary=signature');
    assert.equal(result.headers['Cache-Control'],'private, no-store');
    assert.equal(result.headers['Access-Control-Allow-Origin'],'*');
    assert.equal(calls.at(-1)[3].head,method==='HEAD');
    assert.equal(calls.at(-1)[3].disposition,'inline');
   }
  }
  assert.equal((await request('GET','/media/'+'a'.repeat(64)+'.json')).status,404);
 }finally{await rm(directory,{recursive:true,force:true})}
});
test('incremental resource blobs use signed redirects for GET and HEAD while local manifests stay local',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'lovehouse-update-signed-'));
 try{
  const hash='b'.repeat(64),calls:any[]=[];
  const bucket={key:(group:string,id:string)=>group+'/'+id,size:async()=>128,
   signDownload:async(...args:any[])=>{calls.push(args);return 'https://bucket.example/blob?temporary=signature'},
   stream:async()=>{throw Error('Updates must not proxy bucket bytes')},
  };
  const store=createAndroidUpdateStore(directory,bucket,async()=>({...defaultStorageRules,thresholdBytes:0}));
  for(const method of ['GET','HEAD']){
   const {result,sink}=response();
   assert.equal(await store.serve({method,headers:{}},sink,'blobs/'+hash),true);
   assert.equal(result.status,302);
   assert.equal(result.headers.Location,'https://bucket.example/blob?temporary=signature');
   assert.equal(result.headers['Cache-Control'],'private, no-store');
   assert.equal(calls.at(-1)[0],'android-update/blobs/'+hash);
   assert.equal(calls.at(-1)[3].head,method==='HEAD');
  }
  await writeFile(join(directory,'update.json'),'{}');
  const {result,sink}=response();
  assert.equal(await store.serve({method:'HEAD',headers:{}},sink,'update.json'),true);
  assert.equal(result.status,200);assert.equal(result.headers['Content-Length'],2);
 }finally{await rm(directory,{recursive:true,force:true})}
});
