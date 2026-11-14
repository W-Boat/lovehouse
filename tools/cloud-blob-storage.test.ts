import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
// @ts-ignore JavaScript publisher module.
import {createBlobStore,defaultStorageRules,validateStorageRules} from './cloud-blob-storage.mjs';

test('blob routing uses the configured threshold and fallback for uploads and reads',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'lovehouse-storage-'));
 try{
  const calls:string[]=[];
  let fail=false;
  const objects=new Map<string,Buffer>();
  const bucket={
   key:(group:string,id:string)=>group+'/'+id,
   async put(key:string,bytes:Buffer){
    calls.push('put:'+key);
    if(fail)throw Error('Bucket offline');
    objects.set(key,bytes);
   },
   async stream(key:string,range?:string){
    calls.push('get:'+key+':'+(range??''));
    const bytes=objects.get(key);
    if(!bytes||fail)throw Error('Bucket unavailable');
    return Object.assign(Readable.from([bytes]),{transformToByteArray:async()=>bytes});
   },
  };
  let rules=validateStorageRules({...defaultStorageRules,thresholdBytes:10});
  const storage=createBlobStore('media',bucket,async()=>rules);
  const small=join(directory,'small'),large=join(directory,'large');
  await storage.putBytes('small',small,Buffer.alloc(10,1),'image/webp');
  assert.equal(calls.length,0);
  assert.equal((await readFile(small)).length,10);
  await storage.putBytes('large',large,Buffer.alloc(11,2),'image/webp');
  assert.deepEqual(calls,['put:media/large']);
  await writeFile(large,Buffer.alloc(11,3));
  assert.equal((await storage.bytes('large',large,11))[0],2);
  await storage.stream('large',large,11,{start:0,end:3});
  assert.equal(calls.at(-1),'get:media/large:bytes=0-3');
  fail=true;
  assert.equal((await storage.bytes('large',large,11))[0],3);
  await storage.putBytes('large',large,Buffer.alloc(11,4),'image/webp');
  assert.equal((await readFile(large))[0],4);
  rules=validateStorageRules({...rules,large:{...rules.large,download:['s3']}});
  await assert.rejects(storage.bytes('large',large,11),/Bucket unavailable/);
 }finally{await rm(directory,{recursive:true,force:true})}
});
