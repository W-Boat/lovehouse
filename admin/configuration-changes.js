/** Count configuration values, keeping records stable when lists are reordered. */
function entries(value,path=[],result=new Map()){
 if(Array.isArray(value)){
  if(!value.length||value.every(item=>item===null||typeof item!=='object')){
   if(value.length)result.set(JSON.stringify(path),value);
   return result;
  }
  const keyed=value.every(item=>item&&typeof item.id==='string')&&new Set(value.map(item=>item.id)).size===value.length;
  value.forEach((item,index)=>entries(item,[...path,keyed?item.id:index],result));
 }else if(value!==null&&typeof value==='object'){
  for(const [key,item] of Object.entries(value)){
   if(path.length===0&&['schema','revision'].includes(key))continue;
   entries(item,[...path,key],result);
  }
 }else if(value!==undefined)result.set(JSON.stringify(path),value);
 return result;
}
export function configurationChanges(before,after,bundled={}){
 const effective=config=>({...config,texts:{...bundled.texts,...config?.texts}});
 const previous=entries(effective(before)),next=entries(effective(after));
 const changes={added:0,modified:0,removed:0,total:0};
 for(const [key,value] of next){
  if(!previous.has(key))changes.added++;
  else if(JSON.stringify(value)!==JSON.stringify(previous.get(key)))changes.modified++;
 }
 for(const key of previous.keys())if(!next.has(key))changes.removed++;
 changes.total=changes.added+changes.modified+changes.removed;
 return changes;
}


export function sameConfiguration(left,right){
 if(left===right)return true;
 if(!left||!right||typeof left!=='object'||typeof right!=='object'||Array.isArray(left)!==Array.isArray(right))return false;
 const keys=Object.keys(left);
 return keys.length===Object.keys(right).length&&keys.every(key=>Object.hasOwn(right,key)&&sameConfiguration(left[key],right[key]));
}

export function mergeConfiguration(base,draft,live){
 const conflicts=[];
 const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 function merge(before,local,remote,path){
  if(sameConfiguration(local,before))return remote;
  if(sameConfiguration(remote,before)||sameConfiguration(local,remote))return local;
  if((before===undefined||isRecord(before))&&isRecord(local)&&isRecord(remote)){
   const keys=new Set([...Object.keys(before??{}),...Object.keys(local),...Object.keys(remote)]);
   return Object.fromEntries([...keys].flatMap(key=>{
    const value=merge(before?.[key],local[key],remote[key],[...path,key]);
    return value===undefined?[]:[[key,value]];
   }));
  }
  conflicts.push(path.join(' / '));
  return local;
 }
 return {config:merge(base,draft,live,[]),conflicts};
}
