const error=document.querySelector('#error');
async function loadDownloads(){
 error.hidden=true;
 try{
  const endpoint=new URL('../packages.json',location.href);
  const response=await fetch(endpoint,{cache:'no-store'});
  if(!response.ok)throw Error('Package list unavailable');
  const catalog=await response.json();
  for(const [platform,extension] of [['android','.apk'],['windows','.zip']]){
   const card=document.getElementById(platform);
   const link=card.querySelector('a');
   const entry=catalog[platform];
   const url=entry?.path?new URL(entry.path,endpoint):null;
   if(!url||url.origin!==endpoint.origin||!url.pathname.startsWith(new URL('./packages/',endpoint).pathname)||!url.pathname.endsWith(extension)){
    card.querySelector('p').textContent='暂未发布';
    link.hidden=true;
    continue;
   }
   card.querySelector('p').textContent=entry.version+' · '+(entry.bytes/1048576).toFixed(1)+' MiB';
   link.href=url.href;
   link.hidden=false;
  }
 }catch{
  for(const card of document.querySelectorAll('.platform'))card.querySelector('p').textContent='暂无法读取';
  error.hidden=false;
 }
}
error.querySelector('button').addEventListener('click',loadDownloads);
void loadDownloads();
