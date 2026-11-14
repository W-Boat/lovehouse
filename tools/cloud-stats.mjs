import {readFile,writeFile,rename,rm} from 'node:fs/promises';
import {isIP} from 'node:net';
import {randomUUID} from 'node:crypto';

const retention=7*86400000;
const onlineWindow=6*60000;
export function validateStats(value){
 if(value===undefined)return;
 if(!value||typeof value!=='object'||typeof value.enabled!=='boolean')throw Error('Invalid statistics configuration');
 return {enabled:value.enabled};
}
export function createStats(file){
 const database=file+'.statistics.json';
 let pending=Promise.resolve();
 const queue=action=>{
  const result=pending.then(action);pending=result.catch(()=>{});return result;
 };
 async function load(){
  try{return JSON.parse(await readFile(database,'utf8'))}
  catch(error){if(error.code==='ENOENT')return [];throw error}
 }
 async function save(rows){
  const temporary=database+'.'+randomUUID()+'.part';
  try{await writeFile(temporary,JSON.stringify(rows),{mode:0o600});await rename(temporary,database)}
  finally{await rm(temporary,{force:true})}
 }
 return {
  async record(request,response){
   const end=status=>response.writeHead(status,{'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'}).end();
   try{
    const config=JSON.parse(await readFile(file,'utf8'));
    if(config.statistics?.enabled!==true){request.resume();end(204);return}
    if(!request.headers['content-type']?.startsWith('application/x-www-form-urlencoded')){request.resume();end(415);return}
    let raw='';
    for await(const chunk of request){raw+=chunk.toString();if(raw.length>512){end(413);return}}
    const fields=new URLSearchParams(raw),id=fields.get('session');
    if(!id||!/^[a-f0-9-]{36}$/.test(id)){end(400);return}
    const peer=request.socket.remoteAddress??'';
    const forwarded=request.headers['x-real-ip'];
    const ip=/^(?:::ffff:)?127\.|^::1$/.test(peer)&&typeof forwarded==='string'&&isIP(forwarded)?forwarded:peer;
    await queue(async()=>{
     const now=Date.now(),rows=(await load()).filter(row=>now-row.lastSeenAt<retention);
     const existing=rows.find(row=>row.id===id);
     if(existing&&now-existing.lastSeenAt<60000)return;
     if(existing)existing.lastSeenAt=now;
     else rows.unshift({id,ip,platform:fields.get('platform')?.slice(0,80)??'',screen:fields.get('screen')?.slice(0,20)??'',language:fields.get('language')?.slice(0,24)??'',userAgent:String(request.headers['user-agent']??'').slice(0,240),enteredAt:now,lastSeenAt:now});
     await save(rows.slice(0,10000));
    });
    end(204);
   }catch{end(503)}
  },
  summary:()=>queue(async()=>{
   const now=Date.now(),all=await load(),rows=all.filter(row=>now-row.lastSeenAt<retention);
   if(rows.length!==all.length)await save(rows);
   rows.sort((a,b)=>b.lastSeenAt-a.lastSeenAt);
   return {online:rows.filter(row=>now-row.lastSeenAt<onlineWindow).length,sessions:rows.map(({id,...row})=>({...row,enteredAt:new Date(row.enteredAt).toISOString(),lastSeenAt:new Date(row.lastSeenAt).toISOString()}))};
  }),
 };
}
