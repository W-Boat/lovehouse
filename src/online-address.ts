/** A publisher base can be mounted below a reverse-proxy directory. */
export function onlineServerFromContent(base:string){
 if(!base.trim())return '';
 try{
  const url=new URL(base);
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return '';
  url.search='';url.hash='';
  url.pathname=url.pathname.replace(/\/?$/,'/');
  return new URL('online',url).href;
 }catch{return ''}
}

export function serverAddress(value:string,pageUrl:string,defaultServer=''){
 const page=new URL(pageUrl),input=value.trim()||defaultServer.trim();
 if(!input&&page.protocol!=='http:'&&page.protocol!=='https:')throw Error('客户端请先填写联机服务器地址');
 const url=new URL(input||'/online',page);
 if(url.protocol==='https:')url.protocol='wss:';
 else if(url.protocol==='http:')url.protocol='ws:';
 if(!['ws:','wss:'].includes(url.protocol))throw Error('服务器地址需要使用 ws、wss、http 或 https');
 if(url.username||url.password||url.hash)throw Error('服务器地址不能包含账号、密码或片段');
 if(page.protocol==='https:'&&url.protocol!=='wss:')throw Error('当前网页需要安全的 wss 联机地址');
 if(!url.pathname||url.pathname==='/')url.pathname='/online';
 return url.href;
}


/** Checks the WebSocket upgrade without creating or joining a room. */
export function probeOnlineServer(address:string,Socket:typeof WebSocket=WebSocket,timeout=3500):Promise<boolean>{
 return new Promise(resolve=>{
  let socket:WebSocket;
  try{socket=new Socket(address)}catch{resolve(false);return}
  function finish(connected:boolean){
   clearTimeout(timer);
   socket.removeEventListener('open',opened);
   socket.removeEventListener('error',failed);
   socket.removeEventListener('close',failed);
   socket.close();
   resolve(connected);
  }
  const opened=()=>finish(true);
  const failed=()=>finish(false);
  const timer=setTimeout(failed,timeout);
  socket.addEventListener('open',opened);
  socket.addEventListener('error',failed);
  socket.addEventListener('close',failed);
 });
}
