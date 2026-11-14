import {randomUUID} from 'node:crypto';
import {lookup} from 'node:dns';
import {Agent} from 'node:https';
import ipaddr from 'ipaddr.js';
import {createReadStream} from 'node:fs';
import {readFile,rename,rm,stat,writeFile} from 'node:fs/promises';

function missing(error){
 return error.code==='ENOENT'||error.$metadata?.httpStatusCode===404;
}

export function bucketEnvironment(env=process.env){
 if(!env.LOVEHOUSE_S3_BUCKET?.trim())return;
 return {
  bucket:env.LOVEHOUSE_S3_BUCKET,region:env.LOVEHOUSE_S3_REGION,
  endpoint:env.LOVEHOUSE_S3_ENDPOINT,prefix:env.LOVEHOUSE_S3_PREFIX,
  accessKeyId:env.LOVEHOUSE_S3_ACCESS_KEY_ID,secretAccessKey:env.LOVEHOUSE_S3_SECRET_ACCESS_KEY,
  sessionToken:env.LOVEHOUSE_S3_SESSION_TOKEN,pathStyle:env.LOVEHOUSE_S3_PATH_STYLE==='true',
 };
}

export function validateBucket(input,previous){
 function field(key,fallback='',limit=256){
  const value=input?.[key]??fallback;
  if(typeof value!=='string'||value.length>limit||/[\x00-\x1f\x7f]/.test(value))throw Error('无效的储存桶字段 '+key);
  return value.trim();
 }
 const config={
  bucket:field('bucket'),region:field('region'),endpoint:field('endpoint','',2048),
  prefix:field('prefix','lovehouse').replace(/^\/+|\/+$/g,''),
  pathStyle:input?.pathStyle===true,
  accessKeyId:field('accessKeyId')||previous?.accessKeyId||'',
  secretAccessKey:field('secretAccessKey')||previous?.secretAccessKey||'',
  sessionToken:input?.clearSessionToken===true?'':field('sessionToken','',8192)||previous?.sessionToken||'',
 };
 if(!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(config.bucket)||
    !/^[a-z0-9-]{1,64}$/.test(config.region)||!config.accessKeyId||!config.secretAccessKey||
    (config.prefix&&!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(config.prefix)))
  throw Error('请检查桶名、区域、对象前缀和访问凭据');
 if(config.endpoint){
  let url;
  try{url=new URL(config.endpoint)}catch{throw Error('请输入有效的 HTTPS S3 端点')}
  const host=url.hostname.replace(/^\[|\]$/g,'');
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'||
     (url.port&&url.port!=='443')||!host.includes('.')||ipaddr.isValid(host))
   throw Error('S3 端点必须是使用 443 端口的公网 HTTPS 域名');
  config.endpoint=url.origin;
 }
 return config;
}

function publicLookup(host,options,done){
 lookup(host,{...options,all:true},(error,addresses)=>{
  if(error)return done(error);
  if(!addresses.length||addresses.some(({address})=>ipaddr.process(address).range()!=='unicast'))
   return done(Error('S3 端点只能连接公网地址'));
  if(options.all)return done(null,addresses);
  done(null,addresses[0].address,addresses[0].family);
 });
}

export function createBucket(config,{probe=false}={}){
 const {bucket,region,endpoint,prefix,accessKeyId,secretAccessKey,sessionToken,pathStyle}=validateBucket(config);
 let sdk;
 async function command(name,details,timeout=30000){
  sdk??=Promise.all([import('@aws-sdk/client-s3'),import('@smithy/node-http-handler')]).then(([s3,{NodeHttpHandler}])=>({
   s3,client:new s3.S3Client({
    region,endpoint,forcePathStyle:pathStyle,followRegionRedirects:false,
    maxAttempts:probe?1:3,requestHandler:new NodeHttpHandler({httpsAgent:new Agent({lookup:publicLookup,keepAlive:true}),connectionTimeout:5000}),
    credentials:{accessKeyId,secretAccessKey,sessionToken:sessionToken||undefined},
    requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED',
   }),
  }));
  const {client,s3}=await sdk;
  try{return await client.send(new s3[name]({Bucket:bucket,...details}),{abortSignal:AbortSignal.timeout(probe?7000:timeout)})}
  catch(error){
   if(missing(error))return;
   throw Error('Bucket operation failed: '+name,{cause:error});
  }
 }
 return {
  async signUpload(key,size,mime,sha256){
   await command('HeadObjectCommand',{Key:key});
   const {client,s3}=await sdk;
   const {getSignedUrl}=await import('@aws-sdk/s3-request-presigner');
   return getSignedUrl(client,new s3.PutObjectCommand({Bucket:bucket,Key:key,ContentLength:size,ContentType:mime,ChecksumSHA256:Buffer.from(sha256,'hex').toString('base64')}),{expiresIn:900,signableHeaders:new Set(['content-length','content-type']),unhoistableHeaders:new Set(['x-amz-checksum-sha256'])});
  },
  async signDownload(key,name,mime,{head=false,disposition="attachment"}={}){
   await command('HeadObjectCommand',{Key:key});
   // Some S3 providers accept APK uploads and HEAD but forbid GET. Honor
   // the configured local fallback instead of redirecting to a known 403.
   if(name.endsWith('.apk')){
    const probe=await command('GetObjectCommand',{Key:key,Range:'bytes=0-0'});
    probe?.Body?.destroy();
   }
   const {client,s3}=await sdk;
   const {getSignedUrl}=await import('@aws-sdk/s3-request-presigner');
   const operation=head?s3.HeadObjectCommand:s3.GetObjectCommand;
   return getSignedUrl(client,new operation({Bucket:bucket,Key:key,
    ResponseContentDisposition:disposition+'; filename="'+name+'"',ResponseContentType:mime}),{expiresIn:900});
  },
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
  async close(){if(sdk)(await sdk).client.destroy()},
  key(group,id){return [prefix,group,id].filter(Boolean).join('/')},
 };
}

export async function testBucket(config){
 const bucket=createBucket(config,{probe:true});
 const key=bucket.key('connection-test',randomUUID()+'.txt');
 const expected=Buffer.from('Lovehouse bucket connection test');
 let stage='写入',failure;
 try{
  await bucket.put(key,expected,expected.length,'text/plain');
  stage='读取';
  const response=await bucket.stream(key);
  const bytes=await response.transformToByteArray();
  if(!expected.equals(bytes))throw Error('测试对象校验失败');
 }catch(error){failure=Error('储存桶'+stage+'失败，请检查端点、区域、凭据和对象权限',{cause:error})}
 try{await bucket.delete(key)}
 catch{throw Error((failure?failure.message+'。':'')+'测试对象清理失败，请检查删除权限')}
 finally{await bucket.close().catch(()=>{})}
 if(failure)throw failure;
 return {ok:true};
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
 const resolveBucket=typeof bucket==='function'?bucket:async()=>bucket;
 async function localSize(file){
  try{return (await stat(file)).size}catch(error){if(!missing(error))throw error}
 }
 async function route(operation,size,actions){
  const active=await resolveBucket();
  if(!active)return actions.local();
  const rules=await getRules();
  const destinations=rules[size>rules.thresholdBytes?'large':'small'][operation];
  let failure;
  for(const destination of destinations){
   try{return await actions[destination](active)}
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
    s3:active=>active.put(active.key(group,id),bytes,bytes.length,mime),
   });
  },
  putFile(id,file,temporary,size,mime){
   return route('upload',size,{
    local:()=>rename(temporary,file),
    s3:async active=>{
     const key=active.key(group,id);
     if(await active.size(key)===size)return;
     const stream=createReadStream(temporary);
     try{await active.put(key,stream,size,mime)}finally{stream.destroy()}
    },
   });
  },
  async size(id,file){
   const local=await localSize(file);
   if(local!==undefined)return local;
   const active=await resolveBucket();
   return active?.size(active.key(group,id));
  },
  downloadUrl(id,file,size,name,mime,options){
   return route('download',size,{
    local:async()=>{
     if(await localSize(file)===undefined)throw Object.assign(Error('File missing'),{code:'ENOENT'});
     return null;
    },
    s3:async active=>{
     const key=active.key(group,id);
     if(await active.size(key)!==size)throw Object.assign(Error('Object missing'),{code:'ENOENT'});
     return active.signDownload(key,name,mime,options);
    },
   });
  },
  bytes(id,file,size){
   return route('download',size,{
    local:()=>readFile(file),
    s3:async active=>Buffer.from(await (await active.stream(active.key(group,id))).transformToByteArray()),
   });
  },
  stream(id,file,size,range){
   return route('download',size,{
    local:()=>openLocal(file,range),
    s3:active=>active.stream(active.key(group,id),range?'bytes='+range.start+'-'+range.end:undefined),
   });
  },
  async remove(id,file){
   const active=await resolveBucket();
   if(active)await active.delete(active.key(group,id));
   await rm(file,{force:true});
  },
 };
}
