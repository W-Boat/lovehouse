import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
// @ts-ignore Publisher module.
import {createPackageStore} from './cloud-packages.mjs';
// @ts-ignore Publisher module.
import {defaultStorageRules} from './cloud-blob-storage.mjs';

test('package downloads redirect GET, HEAD and ranges to private bucket without streaming via publisher',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'lovehouse-redirect-'));
 try{
  const sha='a'.repeat(64),size=12;
  const calls:any[]=[];
  let offline=false;
  const bucket={key:(group:string,id:string)=>group+'/'+id,
   size:async()=>{if(offline)throw Error('Offline');return size},
   signDownload:async(...args:any[])=>{calls.push(args);return 'https://bucket.example/download?signature=temporary'},
   stream:async()=>{throw Error('Must not stream bucket bytes')},
  };
  const rules={...defaultStorageRules,thresholdBytes:1};
  const store=createPackageStore(directory,'/lovehouse',bucket,async()=>rules);
  const pathname='/packages/'+sha+'/lovehouse-windows-2.0.0.zip';
  for(const [method,headers] of [['GET',{}],['HEAD',{}],['GET',{range:'bytes=4-'}]] as const){
   let status=0,out:any;
   const response={writeHead(code:number,h:any){status=code;out=h;return this},end(){}};
   assert.equal(await store.serve({method,headers},response,pathname),true);
   assert.equal(status,302);
   assert.equal(out.Location,'https://bucket.example/download?signature=temporary');
   assert.equal(out['Cache-Control'],'private, no-store');
   assert.equal(calls.at(-1)[3].head,method==='HEAD');
   assert.equal(calls.at(-1)[1],'lovehouse-windows-2.0.0.zip');
  }
  // A bucket failure still permits an existing local package to be served.
  await writeFile(join(directory,sha+'.zip'),Buffer.alloc(size));
  offline=true;
  let status=0,out:any;
  const response={writeHead(code:number,h:any){status=code;out=h;return this},end(){}};
  assert.equal(await store.serve({method:'HEAD',headers:{range:'bytes=-4'}},response,pathname),true);
  assert.equal(status,206);
  assert.equal(out['Content-Range'],'bytes 8-11/12');
 }finally{await rm(directory,{recursive:true,force:true})}
});

test('Android packages use their dedicated bucket while Windows keep the general bucket',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'lovehouse-android-bucket-'));
 try{
  const sha='c'.repeat(64),calls:string[]=[];
  const bucket=(label:string)=>({key:(group:string,id:string)=>group+'/'+id,
   size:async()=>12,
   signDownload:async()=>{calls.push(label);return 'https://'+label+'.example/signed'},
  });
  const store=createPackageStore(directory,'/lovehouse',bucket('general'),async()=>({...defaultStorageRules,thresholdBytes:0}),bucket('android'));
  for(const platform of ['android','windows']){
   const extension=platform==='android'?'apk':'zip';
   let headers:any;
   const sink={writeHead(code:number,h:any){assert.equal(code,302);headers=h;return this},end(){}};
   assert.equal(await store.serve({method:'GET',headers:{}},sink,'/packages/'+sha+'/lovehouse-'+platform+'-build.'+extension),true);
   assert.equal(headers.Location,'https://'+(platform==='android'?'android':'general')+'.example/signed');
  }
  assert.deepEqual(calls,['android','general']);
 }finally{await rm(directory,{recursive:true,force:true})}
});

test('sign-only publication requires explicit local verification and downloads without bucket network requests',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'lovehouse-sign-only-'));
 try{
  const sha='d'.repeat(64),metadata={platform:'android',version:'build1',sha256:sha,bytes:12};
  const bucket={signOnly:true,key:(group:string,id:string)=>group+'/'+id,
   size:async()=>{throw Error('Server must not contact bucket')},
   stream:async()=>{throw Error('Server must not download bucket bytes')},
   signUpload:async()=> 'https://bucket.example/upload-signed',
   signDownload:async()=> 'https://bucket.example/download-signed',
  };
  const store=createPackageStore(directory,'/lovehouse',bucket,async()=>({...defaultStorageRules,thresholdBytes:0}));
  const prepared=await store.direct('prepare',metadata,(fn:any)=>fn());
  assert.equal(prepared.verifyLocally,true);assert.equal(prepared.downloadUrl,'https://bucket.example/download-signed');
  await assert.rejects(store.direct('finish',metadata,(fn:any)=>fn()),/Local bucket read-back/);
  const entry=await store.direct('finish',{...metadata,verifiedLocally:true},(fn:any)=>fn());
  const sink={writeHead(status:number,headers:any){assert.equal(status,302);assert.equal(headers.Location,prepared.downloadUrl);return this},end(){}};
  assert.equal(await store.serve({method:'GET',headers:{}},sink,entry.path.slice('/lovehouse'.length)),true);
 }finally{await rm(directory,{recursive:true,force:true})}
});
