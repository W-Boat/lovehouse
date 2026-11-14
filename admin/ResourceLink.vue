<script setup>
import {inject,ref} from 'vue';
import {NInput,NButton,NUpload,NProgress} from 'naive-ui';
const props=defineProps({value:String,accept:String,placeholder:String});
const emit=defineEmits(['update:value']);
const token=inject('publisherToken',ref(''));
const busy=ref(false),error=ref(''),progress=ref(0);
async function upload({file,onFinish,onError}){
 const raw=file.file;if(!raw){onError();return}
 busy.value=true;error.value='';progress.value=0;
 try{
  const asset=await new Promise((resolve,reject)=>{
   const request=new XMLHttpRequest();
   request.open('POST',import.meta.env.BASE_URL+'api/assets');
   request.timeout=90000;
   request.setRequestHeader('Authorization','Bearer '+token.value);
   request.setRequestHeader('X-Asset-Name',encodeURIComponent(raw.name));
   request.upload.onprogress=event=>{if(event.lengthComputable)progress.value=Math.round(event.loaded/event.total*100)};
   request.onload=()=>{try{const data=JSON.parse(request.responseText);if(request.status>=200&&request.status<300)resolve(data.asset);else reject(Error(data.error||'上传失败'))}catch(e){reject(e)}};
   request.onerror=request.ontimeout=()=>reject(Error('网络中断，请重试'));
   request.send(raw);
  });
  emit('update:value',new URL(asset.path,location.origin).href);onFinish();
 }catch(e){error.value=e.message;onError()}finally{busy.value=false}
}
</script>
<template>
 <div class="resource-link">
  <n-input :value="props.value" :placeholder="placeholder||'https://…'" clearable @update:value="emit('update:value',$event)"/>
  <n-upload :accept="accept" :show-file-list="false" :custom-request="upload" :disabled="busy||!token">
   <n-button secondary :loading="busy">上传文件</n-button>
  </n-upload>
  <n-progress v-if="busy" type="line" :percentage="progress"/>
  <small v-if="error" role="alert">{{error}}</small>
 </div>
</template>
<style scoped>
.resource-link{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px}.resource-link small,.resource-link :deep(.n-progress){grid-column:1/-1}.resource-link small{color:#ac3636}
</style>
