import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,rename,rm} from 'node:fs/promises';
import {clientIp} from './cloud-stats.mjs';

export function createAnnouncementClaims(file){
 const database=file+'.announcement-claims.json';
 let pending=Promise.resolve();
 return async(request,response)=>{
  const send=(status,body)=>response.writeHead(status,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Cache-Control':'no-store'}).end(JSON.stringify(body));
  try{
   let raw='';
   for await(const chunk of request){raw+=chunk.toString();if(raw.length>256){send(413,{});return}}
   const kind=new URLSearchParams(raw).get('kind');
   if(!['announcement','notification'].includes(kind)){send(400,{});return}
   const operation=pending.then(async()=>{
    const content=JSON.parse(await readFile(file,'utf8'));
    const notice=content[kind];
    if(!notice?.enabled||!notice.body?.trim())return {};
    const identity=JSON.stringify([kind,notice.title,notice.body]);
    const key=createHash('sha256').update(clientIp(request)+'\0'+identity).digest('hex');
    let claims={};
    try{claims=JSON.parse(await readFile(database,'utf8'))}
    catch(error){if(error.code!=='ENOENT')throw error}
    if(claims[key])return {};
    claims[key]=Date.now();
    const temp=database+'.'+randomUUID()+'.part';
    try{await writeFile(temp,JSON.stringify(claims),{mode:0o600});await rename(temp,database)}
    finally{await rm(temp,{force:true})}
    return {notice};
   });
   pending=operation.catch(()=>{});
   send(200,await operation);
  }catch{send(503,{})}
 };
}
