const CACHE='cottage-release-resources-v1';
const cachedUrls=new Map<string,string>();
export const preparedResource=(url:string)=>cachedUrls.get(url)??url;

export async function prepareReleaseResources(snapshot:unknown,server:URL){
 const origin=server.origin;
 const scope=new URL('media/',server).pathname;
 const urls=new Set<string>();
 function scan(value:unknown){
  if(typeof value==='string'){
   try{
    const url=new URL(value);
    const hosted=url.origin===origin&&url.pathname.startsWith(scope)&&/^[a-f0-9]{64}\.[a-z0-9]+$/.test(url.pathname.slice(scope.length));
    const externalFile=url.protocol==='https:'&&!url.username&&!url.password&&/\.(?:webp|png|jpe?g|avif|gif|mp3|wav|ogg|m4a|flac|mp4|lrc|json|zip)$/i.test(url.pathname);
    if(hosted||externalFile)urls.add(url.href);
   }catch{}
  }else if(value&&typeof value==='object')Object.values(value).forEach(scan);
 }
 scan(snapshot);
 if(!urls.size)return;
 const cache=await globalThis.caches?.open(CACHE).catch(()=>undefined);
 let done=0,failed=0;
 const report=()=>document.dispatchEvent(new CustomEvent('cottage-cloud-progress',{detail:{done,total:urls.size,failed}}));
 report();
 const remaining=[...urls];
 const deadline=Date.now()+12000;
 await Promise.all(Array.from({length:Math.min(3,remaining.length)},async()=>{
  while(remaining.length){
   const url=remaining.shift()!;
   try{
    if(Date.now()>=deadline)throw Error('Startup resource budget exhausted');
    let response=await cache?.match(url);
    if(!response){
     response=await fetch(url,{credentials:'omit',signal:AbortSignal.timeout(Math.max(1,deadline-Date.now()))});
     if(!response.ok||Number(response.headers.get('content-length'))>16*1024*1024)throw Error('Resource unavailable');
    }
    const reader=response.body?.getReader();
    if(!reader)throw Error('Missing resource');
    const chunks:Uint8Array<ArrayBuffer>[]=[];
    let size=0;
    try{
     while(true){
      const {value,done}=await reader.read();if(done)break;
      size+=value.byteLength;if(size>16*1024*1024)throw Error('Resource too large');
      chunks.push(new Uint8Array(value));
     }
    }catch(error){void reader.cancel().catch(()=>{});throw error}
    const blob=new Blob(chunks,{type:response.headers.get('content-type')??''});
    try{await cache?.put(url,new Response(blob,{headers:{'content-type':blob.type}}))}catch{}
    if(!new URL(url).pathname.endsWith('.html'))cachedUrls.set(url,URL.createObjectURL(blob));
   }catch{failed++}
   finally{done++;report()}
  }
 }));
}
export async function preparedPage(url:string){
 if(!/\/media\/[a-f0-9]{64}\.html$/.test(url))return {url};
 try{
  const cache=await globalThis.caches?.open(CACHE);
  const response=await cache?.match(url);
  if(response){
   const html=await response.text();
   // A srcdoc page uses the iframe sandbox. Add the same resource restrictions as the hosted page.
   const policy="default-src 'none'; script-src 'unsafe-inline' https:; style-src 'unsafe-inline' https:; img-src https: data: blob:; media-src https: data: blob:; connect-src https:; font-src https: data:";
   const base=url.replace(/[&"<>]/g,character=>({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[character]!));
   return {url,html:'<!doctype html><meta http-equiv="Content-Security-Policy" content="'+policy+'"><base href="'+base+'">'+html};
  }
 }catch{}
 return {url};
}
