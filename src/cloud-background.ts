const cacheName='lovehouse-cloud-backgrounds-v1';
const limit=4*1024*1024;
const imageTypes=new Set(['image/webp','image/png','image/jpeg','image/avif']);

async function decode(blob:Blob){
 if(!imageTypes.has(blob.type)||blob.size>limit)throw Error('Invalid scene image');
 const objectUrl=URL.createObjectURL(blob);
 const image=new Image();
 try{
  image.src=objectUrl;
  await image.decode();
  if(image.naturalWidth>4096||image.naturalHeight>4096)throw Error('Scene image dimensions exceed limit');
  return image;
 }finally{URL.revokeObjectURL(objectUrl)}
}

export async function loadCloudBackground(url:string){
 const cache=await globalThis.caches?.open(cacheName).catch(()=>undefined);
 const cached=await cache?.match(url).catch(()=>undefined);
 if(cached){
  try{return await decode(await cached.blob())}
  catch{await cache?.delete(url).catch(()=>{})}
 }
 const response=await fetch(url,{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(8000)});
 const mime=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()??'';
 if(!response.ok||!imageTypes.has(mime)||Number(response.headers.get('content-length'))>limit||!response.body)
  throw Error('Scene image unavailable');
 const reader=response.body.getReader();
 const chunks:Uint8Array<ArrayBuffer>[]=[];
 let bytes=0;
 try{
  while(true){
   const {value,done}=await reader.read();
   if(done)break;
   bytes+=value.byteLength;
   if(bytes>limit)throw Error('Scene image exceeds 4 MiB');
   chunks.push(new Uint8Array(value));
  }
 }catch(error){void reader.cancel().catch(()=>{});throw error}
 const blob=new Blob(chunks,{type:mime});
 const image=await decode(blob);
 if(cache){
  try{
   await cache.put(url,new Response(blob,{headers:{'content-type':mime}}));
   const entries=await cache.keys();
   for(const entry of entries.slice(0,-24))await cache.delete(entry);
  }catch{}
 }
 return image;
}
