<script setup>
import BucketConnection from './BucketConnection.vue';
import {onMounted,ref} from 'vue';
import {NAlert,NButton,NForm,NFormItem,NInputNumber,NSelect,NSpace} from 'naive-ui';

const props=defineProps({token:String});
const emit=defineEmits(['bucket-saved']);
const current=ref(null),draft=ref(null),mode=ref('');
const threshold=ref(null),busy=ref(false),notice=ref(null);
const destinations=[{label:'服务器磁盘',value:'local'},{label:'储存桶',value:'s3'}];
const groups=[['small','不超过阈值'],['large','超过阈值']];
const operations=[['upload','上传'],['download','读取']];

function preferred(route,value){
 route[0]=value;
 if(route[1]===value)route.splice(1);
}
function fallback(route,value){
 route.splice(1,1,...(value?[value]:[]));
}
async function request(save=false){
 busy.value=true;
 notice.value=null;
 try{
  const response=await fetch(import.meta.env.BASE_URL+'api/storage',{
   method:save?'POST':'GET',
   headers:{Authorization:'Bearer '+props.token,...(save?{'Content-Type':'application/json'}:{})},
   body:save?JSON.stringify({current:current.value,next:{...draft.value,thresholdBytes:Math.round(threshold.value*1_000_000)}}):undefined,
  });
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'无法读取存储规则');
  mode.value=data.mode;
  current.value=data.rules;
  draft.value=JSON.parse(JSON.stringify(data.rules));
  threshold.value=data.rules.thresholdBytes/1_000_000;
  if(save)notice.value={type:'success',text:'存储规则已生效。'};
 }catch(error){notice.value={type:'error',text:error.message}}
 finally{busy.value=false}
}
onMounted(()=>request());
</script>

<template>
 <BucketConnection :token="token" @saved="mode='s3'; emit('bucket-saved')"/>
 <BucketConnection :token="token" android/>
 <n-form label-placement="top" style="max-width:640px" @submit.prevent="request(true)">
  <n-alert v-if="mode==='local'" type="info" style="margin-bottom:14px">当前服务器尚未配置储存桶，文件使用本地磁盘。规则可以先保存。</n-alert>
  <template v-if="draft">
   <n-form-item label="文件大小阈值（MB，1 MB = 1,000,000 字节）">
    <n-input-number v-model:value="threshold" :min="0" :max="629.1456" :precision="6" :disabled="busy" style="width:100%"/>
   </n-form-item>
   <fieldset v-for="[group,label] in groups" :key="group" style="margin:0 0 16px;padding:12px;border:1px solid #dce6df">
    <legend>{{label}}</legend>
    <div v-for="[operation,opLabel] in operations" :key="operation" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
     <n-form-item :label="opLabel+'首选'">
      <n-select :value="draft[group][operation][0]" :options="destinations" :disabled="busy" @update:value="value=>preferred(draft[group][operation],value)"/>
     </n-form-item>
     <n-form-item :label="opLabel+'备用'">
      <n-select :value="draft[group][operation][1]??null" :options="destinations.filter(d=>d.value!==draft[group][operation][0])" :disabled="busy" clearable placeholder="不使用备用" @update:value="value=>fallback(draft[group][operation],value)"/>
     </n-form-item>
    </div>
   </fieldset>
  </template>
  <n-space>
   <n-button type="primary" attr-type="submit" :loading="busy" :disabled="!draft||threshold===null">保存存储规则</n-button>
   <n-button :disabled="busy" @click="request()">重新读取</n-button>
  </n-space>
  <n-alert v-if="notice" :type="notice.type" style="margin-top:12px">{{notice.text}}</n-alert>
 </n-form>
</template>
