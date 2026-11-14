<script setup>
import {computed,onMounted,ref} from 'vue';
import {NAlert,NButton,NCard,NCheckbox,NForm,NFormItem,NInput,NSpace,NSwitch,NTag} from 'naive-ui';

const props=defineProps({token:String});
const emit=defineEmits(['saved']);
const defaults={bucket:'',region:'auto',endpoint:'',prefix:'lovehouse',pathStyle:true};
const existing=ref(null),source=ref(''),busy=ref(''),notice=ref(null);
const draft=ref({...defaults,accessKeyId:'',secretAccessKey:'',sessionToken:'',clearSessionToken:false});
const confirmDestinationChange=ref(false);
const changedDestination=computed(()=>existing.value&&['bucket','endpoint','prefix','region'].some(key=>draft.value[key].trim()!==existing.value[key]));
const ready=computed(()=>Boolean(draft.value.bucket.trim()&&draft.value.region.trim()&&
 (existing.value?.hasCredentials||(draft.value.accessKeyId&&draft.value.secretAccessKey))));

function load(data){
 source.value=data.source;
 existing.value=data.configuration;
 draft.value={...defaults,...data.configuration,accessKeyId:'',secretAccessKey:'',sessionToken:'',clearSessionToken:false};
 confirmDestinationChange.value=false;
}
async function request(action){
 if(busy.value)return;
 busy.value=action;
 notice.value=null;
 try{
  const response=await fetch(import.meta.env.BASE_URL+'api/storage/bucket'+(action==='test'?'/test':''),{
   method:action==='load'?'GET':'POST',
   headers:{Authorization:'Bearer '+props.token,...(action==='load'?{}:{'Content-Type':'application/json'})},
   body:action==='load'?undefined:JSON.stringify({...draft.value,confirmDestinationChange:confirmDestinationChange.value}),
   cache:'no-store',
  });
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'无法连接储存桶');
  if(action!=='test')load(data);
  if(action==='test')notice.value={type:'success',text:'已验证写入、读取和删除。当前设置未保存。'};
  if(action==='save'){
   notice.value={type:'success',text:'连接验证通过，储存桶已生效。'};
   emit('saved');
  }
 }catch(error){notice.value={type:'error',text:error.message}}
 finally{busy.value=''}
}
onMounted(()=>request('load'));
</script>

<template>
 <n-card title="储存桶连接" size="small" style="max-width:640px;margin-bottom:24px">
  <template #header-extra>
   <n-tag v-if="source" :type="existing?'success':'default'" size="small">{{existing?(source==='environment'?'服务器环境配置':'后台配置'):'未配置'}}</n-tag>
  </template>
  <n-form label-placement="top" @submit.prevent="request('save')">
   <n-form-item label="桶名称"><n-input v-model:value="draft.bucket" :disabled="!!busy" placeholder="your-private-bucket"/></n-form-item>
   <n-form-item label="区域"><n-input v-model:value="draft.region" :disabled="!!busy" placeholder="R2 填 auto，AWS 填实际区域"/></n-form-item>
   <n-form-item label="S3 API 端点"><n-input v-model:value="draft.endpoint" :disabled="!!busy" placeholder="https://…（AWS 默认端点可留空）"/></n-form-item>
   <n-form-item label="对象前缀"><n-input v-model:value="draft.prefix" :disabled="!!busy" placeholder="lovehouse"/></n-form-item>
   <n-form-item label="路径式寻址"><n-switch v-model:value="draft.pathStyle" :disabled="!!busy"/></n-form-item>
   <n-form-item label="Access Key ID"><n-input v-model:value="draft.accessKeyId" type="password" :disabled="!!busy" :placeholder="existing?.hasCredentials?'留空沿用已保存的值':'输入 Access Key ID'" :input-props="{autocomplete:'off'}"/></n-form-item>
   <n-form-item label="Secret Access Key"><n-input v-model:value="draft.secretAccessKey" type="password" :disabled="!!busy" :placeholder="existing?.hasCredentials?'留空沿用已保存的值':'输入 Secret Access Key'" :input-props="{autocomplete:'new-password'}"/></n-form-item>
   <n-form-item label="Session Token（临时凭据选填）"><n-input v-model:value="draft.sessionToken" type="password" :disabled="!!busy||draft.clearSessionToken" :placeholder="existing?.hasSessionToken?'留空沿用已保存的值':'长期凭据可留空'" :input-props="{autocomplete:'new-password'}"/></n-form-item>
   <n-checkbox v-if="existing?.hasSessionToken" v-model:checked="draft.clearSessionToken" :disabled="!!busy">清除旧 Session Token</n-checkbox>
   <n-alert v-if="changedDestination" type="warning" style="margin-bottom:12px">
    <n-checkbox v-model:checked="confirmDestinationChange">已迁移仅存于旧桶的文件，确认切换桶位置</n-checkbox>
   </n-alert>
   <n-space style="margin-top:12px">
    <n-button :disabled="!!busy||!ready" :loading="busy==='test'" @click="request('test')">测试连接</n-button>
    <n-button type="primary" attr-type="submit" :disabled="!!busy||!ready||(changedDestination&&!confirmDestinationChange)" :loading="busy==='save'">验证并保存</n-button>
    <n-button :disabled="!!busy" @click="request('load')">重新读取</n-button>
   </n-space>
   <n-alert v-if="notice" :type="notice.type" style="margin-top:12px">{{notice.text}}</n-alert>
  </n-form>
 </n-card>
</template>
