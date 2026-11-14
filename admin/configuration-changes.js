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
export function configurationChanges(before,after){
 const previous=entries(before),next=entries(after);
 const changes={added:0,modified:0,removed:0,total:0};
 for(const [key,value] of next){
  if(!previous.has(key))changes.added++;
  else if(JSON.stringify(value)!==JSON.stringify(previous.get(key)))changes.modified++;
 }
 for(const key of previous.keys())if(!next.has(key))changes.removed++;
 changes.total=changes.added+changes.modified+changes.removed;
 return changes;
}
