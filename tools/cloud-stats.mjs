import {readFile,writeFile,rename,rm} from 'node:fs/promises';
import {isIP} from 'node:net';
import {randomUUID} from 'node:crypto';

const retention=7*86400000;
const defaultHeartbeatMinutes=5;
const heartbeatWindow=minutes=>(minutes+1)*60000;
export function clientIp(request){
 const peer=request.socket.remoteAddress??'';
 const forwarded=request.headers['x-real-ip'];
 const address=/^(?:::ffff:)?127\.|^::1$/.test(peer)&&typeof forwarded==='string'&&isIP(forwarded)?forwarded:peer;
 return address.replace(/^::ffff:/,'');
}
function unionDuration(intervals){
 const sorted=intervals.sort((a,b)=>a[0]-b[0]);
 let total=0,start=0,end=0;
 for(const [from,to] of sorted){
  if(from>end){total+=end-start;start=from;end=to}
  else end=Math.max(end,to);
 }
 return total+end-start;
}
export function summarizeSessions(rows,now=Date.now(),heartbeatMinutes=defaultHeartbeatMinutes){
 const groups=new Map();
 for(const row of rows){
  const key=JSON.stringify([row.platform,row.userAgent,row.screen??'']);
  let group=groups.get(key);
  if(!group){
   group={ip:row.ip,platform:row.platform,userAgent:row.userAgent,screen:row.screen,enteredAt:row.enteredAt,lastSeenAt:row.lastSeenAt,visits:0,intervals:[]};
   groups.set(key,group);
  }
  group.enteredAt=Math.min(group.enteredAt,row.enteredAt);
  if(row.lastSeenAt>group.lastSeenAt){
   group.lastSeenAt=row.lastSeenAt;
   group.ip=row.ip;
  }
  group.visits++;
  const periods=Array.isArray(row.periods)?row.periods:[[row.enteredAt,row.lastSeenAt]];
  for(const [start,end] of periods)group.intervals.push([Math.max(now-retention,start),Math.min(now,end+heartbeatMinutes*60000)]);
 }
 const sessions=[...groups.values()].sort((a,b)=>b.lastSeenAt-a.lastSeenAt).map(({intervals,...row})=>({
  ...row,online:now-row.lastSeenAt<heartbeatWindow(heartbeatMinutes),estimatedSeconds:Math.round(unionDuration(intervals)/1000),
  enteredAt:new Date(row.enteredAt).toISOString(),lastSeenAt:new Date(row.lastSeenAt).toISOString(),
 }));
 return {heartbeatMinutes,online:sessions.filter(row=>row.online).length,totalEstimatedSeconds:sessions.reduce((sum,row)=>sum+row.estimatedSeconds,0),sessions};
}
export function validateStats(value){
 if(value===undefined)return;
 if(!value||typeof value!=='object'||typeof value.enabled!=='boolean')throw Error('Invalid statistics configuration');
 const {heartbeatMinutes}=value;
 if(heartbeatMinutes!==undefined&&(!Number.isInteger(heartbeatMinutes)||heartbeatMinutes<1||heartbeatMinutes>60))throw Error('心跳间隔必须为 1 至 60 的整数分钟');
 return {enabled:value.enabled,...(heartbeatMinutes===undefined?{}:{heartbeatMinutes})};
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
    const ip=clientIp(request);
    await queue(async()=>{
     const now=Date.now(),rows=(await load()).filter(row=>now-row.lastSeenAt<retention);
     const existing=rows.find(row=>row.id===id);
     if(existing&&now-existing.lastSeenAt<60000)return;
     if(existing){
      const periods=existing.periods??[[existing.enteredAt,existing.lastSeenAt]];
      if(now-existing.lastSeenAt<=heartbeatWindow(config.statistics.heartbeatMinutes??defaultHeartbeatMinutes))periods[periods.length-1][1]=now;
      else periods.push([now,now]);
      existing.periods=periods;existing.lastSeenAt=now;existing.ip=ip;
     }
     else rows.unshift({id,ip,platform:fields.get('platform')?.slice(0,80)??'',screen:fields.get('screen')?.slice(0,20)??'',language:fields.get('language')?.slice(0,24)??'',userAgent:String(request.headers['user-agent']??'').slice(0,240),enteredAt:now,lastSeenAt:now,periods:[[now,now]]});
     await save(rows.slice(0,10000));
    });
    end(204);
   }catch{end(503)}
  },
  summary:()=>queue(async()=>{
   const now=Date.now(),all=await load(),rows=all.filter(row=>now-row.lastSeenAt<retention);
   if(rows.length!==all.length)await save(rows);
   const config=JSON.parse(await readFile(file,'utf8').catch(error=>{if(error.code==='ENOENT')return '{}';throw error}));
   return summarizeSessions(rows,now,config.statistics?.heartbeatMinutes??defaultHeartbeatMinutes);
  }),
 };
}
