import {createReadStream} from 'node:fs';
import {readFile,rename,rm,stat,writeFile} from 'node:fs/promises';

function missing(error){
 return error.code==='ENOENT'||error.$metadata?.httpStatusCode===404;
}

export function createBucket(env=process.env){
 const bucket=env.LOVEHOUSE_S3_BUCKET?.trim();
 if(!bucket)return;
 const region=env.LOVEHOUSE_S3_REGION?.trim();
 const endpoint=env.LOVEHOUSE_S3_ENDPOINT?.trim()||undefined;
 const prefix=(env.LOVEHOUSE_S3_PREFIX??'lovehouse').replace(/^\/+|\/+$/g,'');
 const accessKeyId=env.LOVEHOUSE_S3_ACCESS_KEY_ID;
 const secretAccessKey=env.LOVEHOUSE_S3_SECRET_ACCESS_KEY;
 if(!region||!accessKeyId||!secretAccessKey||
    (prefix&&!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(prefix)))throw Error('Invalid Lovehouse bucket configuration');
 if(endpoint){
  const url=new URL(endpoint);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')
   throw Error('LOVEHOUSE_S3_ENDPOINT must be an HTTPS origin');
 }
 let sdk;
 async function command(name,details,timeout=30000){
  sdk??=import('@aws-sdk/client-s3').then(s3=>({
   s3,client:new s3.S3Client({
    region,endpoint,forcePathStyle:env.LOVEHOUSE_S3_PATH_STYLE==='true',
    credentials:{accessKeyId,secretAccessKey,sessionToken:env.LOVEHOUSE_S3_SESSION_TOKEN||undefined},
    requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED',
   }),
  }));
  const {client,s3}=await sdk;
  try{return await client.send(new s3[name]({Bucket:bucket,...details}),{abortSignal:AbortSignal.timeout(timeout)})}
  catch(error){
   if(missing(error))return;
   throw Error('Bucket operation failed: '+name,{cause:error});
  }
 }
 return {
  async put(key,body,size,mime){
   const uploaded=await command('PutObjectCommand',{Key:key,Body:body,ContentLength:size,ContentType:mime},300000);
   if(!uploaded)throw Error('Bucket unavailable');
  },
  async size(key){return (await command('HeadObjectCommand',{Key:key}))?.ContentLength},
  async stream(key,range){
   const result=await command('GetObjectCommand',{Key:key,Range:range},300000);
   if(!result?.Body)throw Object.assign(Error('Object missing'),{code:'ENOENT'});
   return result.Body;
  },
  async delete(key){await command('DeleteObjectCommand',{Key:key})},
  key(group,id){return [prefix,group,id].filter(Boolean).join('/')},
 };
}

export const defaultStorageRules={
 thresholdBytes:10_000_000,
 small:{upload:['local','s3'],download:['local','s3']},
 large:{upload:['s3','local'],download:['s3','local']},
};

export function validateStorageRules(input){
 const {thresholdBytes}=input??{};
 if(!Number.isSafeInteger(thresholdBytes)||thresholdBytes<0||thresholdBytes>600*1024*1024)
  throw Error('存储阈值必须是 0 至 629145600 字节的整数');
 const result={thresholdBytes};
 for(const group of ['small','large']){
  result[group]={};
  for(const operation of ['upload','download']){
   const route=input[group]?.[operation];
   if(!Array.isArray(route)||route.length<1||route.length>2||
      new Set(route).size!==route.length||route.some(place=>!['local','s3'].includes(place)))
    throw Error('请选择首选存储，备用存储可留空且不能与首选相同');
   result[group][operation]=[...route];
  }
 }
 return result;
}

export function createBlobStore(group,bucket,getRules=async()=>defaultStorageRules){
 const key=id=>bucket.key(group,id);
 async function localSize(file){
  try{return (await stat(file)).size}catch(error){if(!missing(error))throw error}
 }
 async function route(operation,size,actions){
  if(!bucket)return actions.local();
  const rules=await getRules();
  const destinations=rules[size>rules.thresholdBytes?'large':'small'][operation];
  let failure;
  for(const destination of destinations){
   try{return await actions[destination]()}
   catch(error){failure=error}
  }
  throw failure;
 }
 async function openLocal(file,range){
  if(await localSize(file)===undefined)throw Object.assign(Error('File missing'),{code:'ENOENT'});
  return createReadStream(file,range);
 }
 return {
  putBytes(id,file,bytes,mime){
   return route('upload',bytes.length,{
    local:()=>writeFile(file,bytes),
    s3:()=>bucket.put(key(id),bytes,bytes.length,mime),
   });
  },
  putFile(id,file,temporary,size,mime){
   return route('upload',size,{
    local:()=>rename(temporary,file),
    s3:async()=>{
     if(await bucket.size(key(id))===size)return;
     const stream=createReadStream(temporary);
     try{await bucket.put(key(id),stream,size,mime)}finally{stream.destroy()}
    },
   });
  },
  async size(id,file){
   return await localSize(file)??(bucket?await bucket.size(key(id)):undefined);
  },
  bytes(id,file,size){
   return route('download',size,{
    local:()=>readFile(file),
    s3:async()=>Buffer.from(await (await bucket.stream(key(id))).transformToByteArray()),
   });
  },
  stream(id,file,size,range){
   return route('download',size,{
    local:()=>openLocal(file,range),
    s3:()=>bucket.stream(key(id),range?'bytes='+range.start+'-'+range.end:undefined),
   });
  },
  async remove(id,file){
   if(bucket)await bucket.delete(key(id));
   await rm(file,{force:true});
  },
 };
}
