const ids=new Set(['moon','keychain','chestnuts','earphones','band','doll','chocolate','letter','notes','hat','labubu','mystery']);
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const coord=(value,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=max;
export function validateGiftOverrides(value){
 if(value===undefined)return;
 if(!object(value))throw Error('Invalid gifts');
 const result={};
 for(const [id,gift] of Object.entries(value)){
  if(!ids.has(id)||!object(gift))throw Error('Invalid gift ID');
  const fields={};
  for(const [key,v] of Object.entries(gift)){
   if(['name','subtitle','message','variant'].includes(key)&&typeof v==='string'&&v.length<=4000)fields[key]=v;
   else if((key==='x'||key==='y')&&coord(v,key==='x'?640:426))fields[key]=v;
   else if(key==='point'&&Array.isArray(v)&&v.length===2&&coord(v[0],640)&&coord(v[1],426))fields[key]=v;
   else if(key==='image'&&typeof v==='string'&&v.length<=2048){
    if(v===''){fields[key]='';continue}
    const url=new URL(v);
    if(url.protocol!=='https:'||url.username||url.password)throw Error('Gift image requires HTTPS');
    fields[key]=url.href;
   }else throw Error('Invalid gift field: '+key);
  }
  result[id]=fields;
 }
 return result;
}
export function validateAnnouncement(value){
 if(value===undefined)return;
 if(!object(value)||typeof value.enabled!=='boolean'||typeof value.title!=='string'||value.title.length>80||typeof value.body!=='string'||value.body.length>4000)throw Error('Invalid announcement');
 return {enabled:value.enabled,title:value.title,body:value.body};
}
