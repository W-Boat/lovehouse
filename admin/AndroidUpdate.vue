<script setup>
import {ref} from 'vue';
import {ElAlert,ElProgress} from 'element-plus';
const props=defineProps({token:{type:String,required:true}});
const busy=ref(false),progress=ref(0),message=ref(''),error=ref(false);
async function publish(event){
 const files=Array.from(event.target.files);
 event.target.value='';
 if(!files.length||busy.value)return;
 message.value='';error.value=false;
 busy.value=true;progress.value=0;
 try{
  if(!props.token.trim())throw Error('请输入发布令牌');
  const manifest=files.find(file=>file.name==='update.json'&&!/\/blobs\//.test(file.webkitRelativePath));
  const blobs=files.filter(file=>/\/blobs\/[a-f0-9]{64}$/.test(file.webkitRelativePath));
  if(!manifest||!blobs.length)throw Error('请选择已解压的 lovehouse-content-update 目录');
  const base=import.meta.env.BASE_URL+'api/android-update/';
  const send=async(path,file)=>{
   const response=await fetch(base+path,{method:'POST',headers:{Authorization:'Bearer '+props.token.trim()},body:file});
   const result=await response.json();
   if(!response.ok)throw Error(result.error??'上传失败');
   return result;
  };
  for(let index=0;index<blobs.length;index++){
   await send('blobs/'+blobs[index].name,blobs[index]);
   progress.value=Math.floor((index+1)*99/blobs.length);
  }
  const result=await send('publish',manifest);
  progress.value=100;message.value='已发布 Android 资源版本 '+result.version;
 }catch(cause){message.value=cause.message;error.value=true}
 finally{busy.value=false}
}
</script>
<template>
 <section>
  <h3>Android 增量资源</h3>
  <p>选择解压后的 Actions 签名资源目录。文件齐全后才切换版本，Android 在下次启动时应用。</p>
  <label class="import">上传并发布签名资源<input type="file" webkitdirectory multiple :disabled="busy" aria-label="签名资源目录" @change="publish"></label>
  <el-progress v-if="busy" :percentage="progress"/>
  <el-alert v-if="message" :title="message" :type="error?'error':'success'" :closable="false"/>
 </section>
</template>
