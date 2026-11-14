<script setup>
import {NButton,NInput,NTag} from 'naive-ui';
import {PublisherAlert,PublisherColumn,PublisherDialog,PublisherTable} from './publisher-components.js';
import {computed,onBeforeUnmount,ref} from 'vue';

const props=defineProps({token:String,revision:String});
const emit=defineEmits(['restore','import']);
const rows=ref([]),busy=ref(false),error=ref(''),target=ref(null),search=ref('');
const detail=ref(null),current=ref(null),detailsOpen=ref(false);
const controller=new AbortController();
onBeforeUnmount(()=>controller.abort());

const sections=[
 ['texts','文案'],['scenes','场景'],['interactions','互动'],['giftGames','礼物小游戏'],
 ['musicRoom','唱片房'],['media','替换素材'],['portals','传送门'],
];
const filteredRows=computed(()=>{
 const query=search.value.trim().toLowerCase();
 return rows.value.filter(row=>!query||row.revision.includes(query)||formatTime(row.createdAt).toLowerCase().includes(query));
});
function formatTime(value){
 const date=new Date(value);
 return Number.isNaN(date.getTime())?'时间未知':date.toLocaleString();
}
function count(value){
 if(Array.isArray(value))return value.length;
 if(value&&typeof value==='object')return Object.keys(value).length;
 return value===undefined||value===null?0:1;
}
function stable(value){
 if(Array.isArray(value))return value.map(stable);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
 return value;
}
const comparison=computed(()=>sections.map(([key,label])=>({
 key,label,selected:count(detail.value?.[key]),current:count(current.value?.[key]),
 changed:JSON.stringify(stable(detail.value?.[key]))!==JSON.stringify(stable(current.value?.[key])),
})));
const json=computed(()=>detail.value?JSON.stringify(detail.value,null,2):'');

async function api(path,options={}){
 if(!props.token?.trim())throw Error('请输入发布令牌');
 const response=await fetch(import.meta.env.BASE_URL+'api/'+path,{
  ...options,signal:controller.signal,
  headers:{Authorization:'Bearer '+props.token.trim(),'Content-Type':'application/json',...options.headers},
 });
 const data=await response.json();
 if(!response.ok)throw Error(data.error||'请求失败');
 return data;
}
async function run(action){
 if(busy.value)return;
 busy.value=true;error.value='';
 try{await action()}catch(e){if(!controller.signal.aborted)error.value=e.message}
 finally{busy.value=false}
}
async function load(){rows.value=(await api('history')).revisions}
function restore(){
 const revision=target.value;
 target.value=null;
 if(!revision)return;
 run(async()=>{
  await api('rollback',{
   method:'POST',headers:{'If-Match':JSON.stringify(props.revision)},body:JSON.stringify({revision}),
  });
  detail.value=null;detailsOpen.value=false;
  emit('restore');
  await load();
 });
}
function copy(revision){run(async()=>emit('import',await api('history/'+revision)))}
function inspect(revision){
 run(async()=>{
  const [selected,live]=await Promise.all([api('history/'+revision),api('snapshot')]);
  detail.value=selected;current.value=live;detailsOpen.value=true;
 });
}
</script>

<template>
 <div class="history-tools">
  <n-input v-model:value="search" clearable placeholder="搜索版本号或保存时间" aria-label="搜索发布历史"/>
  <n-button :loading="busy" @click="run(load)">读取发布历史</n-button>
 </div>
 <publisher-alert v-if="error" :title="error" type="error" :closable="false"/>
 <publisher-table :data="filteredRows" :empty-text="search?'没有匹配的版本':'点击读取发布历史以查看可用版本'">
  <publisher-column label="版本" min-width="160"><template #default="{row}"><code>{{row.revision.slice(0,12)}}</code><n-tag v-if="row.current" class="current-tag" size="small" type="success">当前</n-tag></template></publisher-column>
  <publisher-column label="保存时间" min-width="180"><template #default="{row}">{{formatTime(row.createdAt)}}</template></publisher-column>
  <publisher-column label="大小" width="90"><template #default="{row}">{{(row.bytes/1024).toFixed(1)}} KB</template></publisher-column>
  <publisher-column label="操作" min-width="230"><template #default="{row}">
   <n-button text :disabled="busy" @click="inspect(row.revision)">详情</n-button>
   <n-button text :disabled="busy" @click="copy(row.revision)">导入草稿</n-button>
   <n-button text type="warning" :disabled="busy||row.current||!revision" @click="target=row.revision">回滚</n-button>
  </template></publisher-column>
 </publisher-table>
 <publisher-dialog v-model="detailsOpen" title="版本详情" width="min(820px,94vw)">
  <p class="full-revision">{{detail?.revision}}</p>
  <p>条目数量与当前线上版本比较。唱片房和替换素材按配置字段计数。</p>
  <publisher-table :data="comparison" size="small">
   <publisher-column prop="label" label="分区"/>
   <publisher-column prop="selected" label="所选版本" width="110"/>
   <publisher-column prop="current" label="当前线上" width="110"/>
   <publisher-column label="变化" width="100"><template #default="{row}"><n-tag :type="row.changed?'warning':'info'" size="small">{{row.changed?'有变化':'一致'}}</n-tag></template></publisher-column>
  </publisher-table>
  <details class="snapshot-json"><summary>完整配置 JSON</summary><n-input :value="json" type="textarea" readonly :rows="12" aria-label="版本完整配置 JSON"/></details>
  <template #footer><n-button @click="detailsOpen=false">关闭</n-button><n-button type="primary" :disabled="busy||!detail" @click="emit('import',detail);detailsOpen=false">导入为草稿</n-button></template>
 </publisher-dialog>
 <publisher-dialog :model-value="Boolean(target)" title="回滚线上配置？" width="min(440px,94vw)" @close="target=null">
  <p>玩家下次同步时会使用选中的版本。</p><p class="full-revision">{{target}}</p>
  <template #footer><n-button @click="target=null">取消</n-button><n-button type="warning" :disabled="busy" @click="restore">确认回滚</n-button></template>
 </publisher-dialog>
</template>

<style scoped>
.history-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.history-tools .n-input{max-width:300px}.current-tag{margin-left:8px}.full-revision{overflow-wrap:anywhere;font-family:Consolas,monospace;font-size:12px;color:#53665b}.snapshot-json{margin-top:18px}.snapshot-json summary{cursor:pointer;margin-bottom:10px}.snapshot-json :deep(textarea){font-family:Consolas,monospace;font-size:12px;line-height:1.5}
</style>
