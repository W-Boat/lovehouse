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
