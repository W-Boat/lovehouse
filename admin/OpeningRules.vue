<script setup>
import {onMounted,ref} from 'vue';
import {NAlert,NButton,NDatePicker,NDynamicTags,NForm,NFormItem,NSpace,NSwitch} from 'naive-ui';

const props=defineProps({token:String});
const current=ref(null);
const enabled=ref(false),time=ref(null),allowIps=ref([]);
const busy=ref(false),notice=ref(''),type=ref('info');

function showRules(rules){
 current.value=rules;
 enabled.value=rules.enabled;
 time.value=rules.opensAt?Date.parse(rules.opensAt):null;
 allowIps.value=[...rules.allowIps];
}

async function request(save=false){
 busy.value=true;
 notice.value='';
 try{
  const response=await fetch(import.meta.env.BASE_URL+'api/opening',{
   method:save?'POST':'GET',
   headers:{Authorization:'Bearer '+props.token,...(save?{'Content-Type':'application/json'}:{})},
   body:save?JSON.stringify({current:current.value,next:{enabled:enabled.value,opensAt:time.value===null?null:new Date(time.value).toISOString(),allowIps:allowIps.value}}):undefined,
  });
  const rules=await response.json();
  if(!response.ok)throw Error(rules.error||'无法读取开放规则');
  showRules(rules);
  if(save){type.value='success';notice.value='开放规则已生效。'}
 }catch(error){type.value='error';notice.value=error.message}
 finally{busy.value=false}
}

onMounted(()=>request());
</script>

<template>
 <n-form label-placement="top" style="max-width:540px" @submit.prevent="request(true)">
  <n-form-item label="启用定时开放"><n-switch v-model:value="enabled" :disabled="busy||!current"/></n-form-item>
  <n-form-item label="开放时间（当前设备时区）">
   <n-date-picker v-model:value="time" type="datetime" clearable :disabled="busy||!current" style="width:100%"/>
  </n-form-item>
  <n-form-item label="提前进入的 IP">
   <n-dynamic-tags v-model:value="allowIps" :max="100" :disabled="busy||!current"/>
  </n-form-item>
  <p>逐个添加公网 IPv4 或 IPv6。保存后立即生效，到点自动放行。</p>
  <n-space>
   <n-button type="primary" attr-type="submit" :loading="busy" :disabled="!current||(enabled&&time===null)">保存开放规则</n-button>
   <n-button :disabled="busy" @click="request()">重新读取</n-button>
  </n-space>
  <n-alert v-if="notice" :type="type" style="margin-top:12px">{{notice}}</n-alert>
 </n-form>
</template>
