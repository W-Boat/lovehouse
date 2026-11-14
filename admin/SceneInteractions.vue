<script setup>
import {computed,ref,watch} from 'vue';
import {NButton,NCard,NCollapse,NCollapseItem,NEmpty,NForm,NFormItem,NInput,NInputNumber,NSelect,NTag} from 'naive-ui';
import InteractionBehavior from './InteractionBehavior.vue';

const props=defineProps({
 modelValue:{type:Array,required:true},
 scenes:{type:Array,default:()=>[]},
 worlds:{type:Object,default:()=>({})},
 initialZone:{type:String,default:''},
});
const emit=defineEmits(['update:modelValue']);
const zone=ref(''),expanded=ref([]);
const copyFields=[['id','互动 ID',39],['name','名称',48],['action','按钮文案',24],['response','反馈内容',500]];
const coordinates=[['x','展示 X',640],['y','展示 Y',426]];
const scenes=computed(()=>{
 const entries=new Map(Object.entries(props.worlds).map(([id,world])=>[id,{id,name:world.name||id}]));
 for(const scene of props.scenes)if(scene?.id)entries.set(scene.id,{id:scene.id,name:scene.name||scene.id,spawn:scene.spawn});
 for(const record of props.modelValue)if(record.zone&&!entries.has(record.zone))entries.set(record.zone,{id:record.zone,name:record.zone,missing:true});
 return [...entries.values()];
});
const current=computed(()=>scenes.value.find(scene=>scene.id===zone.value));
const groups=computed(()=>{
 const count=new Map();
 for(const record of props.modelValue)count.set(record.zone,(count.get(record.zone)||0)+1);
 return scenes.value.map(scene=>({value:scene.id,label:scene.name+' · '+scene.id+'（'+(count.get(scene.id)||0)+'）'}));
});
const builtInRows=computed(()=>props.worlds[zone.value]?.items??[]);
const rows=computed(()=>props.modelValue.flatMap((record,index)=>record.zone===zone.value?[{record,index}]:[]));
watch([scenes,()=>props.initialZone],([available,preferred])=>{
 if(available.some(scene=>scene.id===zone.value))return;
 zone.value=available.find(scene=>scene.id===preferred)?.id??available.find(scene=>scene.id==='room')?.id??available[0]?.id??'';
},{immediate:true});
watch(zone,()=>{expanded.value=[]});
function update(index,record){
 const next=props.modelValue.slice();
 next[index]=record;
 emit('update:modelValue',next);
}
function field(index,key,value){update(index,{...props.modelValue[index],[key]:value})}
function point(index,axis,value){
 const next=[...(props.modelValue[index].point??[null,null])];
 next[axis]=value;
 field(index,'point',next);
}
function add(){
 if(!current.value||current.value.missing||props.modelValue.length>=100)return;
 const point=current.value.spawn?.length===2?[...current.value.spawn]:[null,null];
 emit('update:modelValue',[...props.modelValue,{id:'cloud-',zone:zone.value,name:'',action:'',response:'',x:point[0],y:point[1],point}]);
 expanded.value=[props.modelValue.length];
}
function remove(index){
 emit('update:modelValue',props.modelValue.filter((_,i)=>i!==index));
 expanded.value=[];
}
</script>

<template>
 <n-card size="small" class="scene-interactions">
  <div class="scene-interactions-toolbar">
   <n-form-item label="所属场景" :show-feedback="false">
    <n-select v-model:value="zone" :options="groups" filterable placeholder="选择场景" aria-label="所属场景"/>
   </n-form-item>
   <n-button type="primary" :disabled="!current||current.missing||modelValue.length>=100" @click="add">新增当前场景互动</n-button>
  </div>
  <p v-if="current?.missing" class="missing-scene">原场景已移除。请为这些互动重新选择场景。</p>
  <n-empty v-if="!rows.length" description="当前场景暂无云端互动"/>
  <n-collapse v-else v-model:expanded-names="expanded">
   <n-collapse-item v-for="{record,index} in rows" :key="index" :name="index" :title="record.name||record.id||'新互动'">
    <template #header-extra><n-tag size="small">{{current?.name||zone}}</n-tag></template>
    <n-form label-placement="top" class="interaction-fields">
     <n-form-item label="所属场景">
      <n-select :value="record.zone" :options="groups" filterable @update:value="value=>field(index,'zone',value)"/>
     </n-form-item>
     <n-form-item v-for="[key,label,max] in copyFields" :key="key" :label="label">
      <n-input :value="record[key]" :maxlength="max" :type="key==='response'?'textarea':'text'" @update:value="value=>field(index,key,value)"/>
     </n-form-item>
     <n-form-item v-for="[key,label,max] in coordinates" :key="key" :label="label">
      <n-input-number :value="record[key]??null" :min="0" :max="max" @update:value="value=>field(index,key,value)"/>
     </n-form-item>
     <n-form-item v-for="[axis,label,max] in [[0,'落脚点 X',640],[1,'落脚点 Y',426]]" :key="label" :label="label">
      <n-input-number :value="record.point?.[axis]??null" :min="0" :max="max" @update:value="value=>point(index,axis,value)"/>
     </n-form-item>
    </n-form>
    <InteractionBehavior :model-value="record" @update:model-value="value=>update(index,value)"/>
    <n-button class="remove-interaction" text type="error" @click="remove(index)">移除互动</n-button>
   </n-collapse-item>
  </n-collapse>
  <n-collapse v-if="builtInRows.length" class="built-in-interactions">
   <n-collapse-item name="built-in" :title="'包内互动（'+builtInRows.length+'）'">
    <ul class="built-in-list">
     <li v-for="item in builtInRows" :key="item.id">
      <strong>{{item.name||item.id}}</strong><span>{{item.action||'场景互动'}}</span>
      <small>{{item.id}}</small>
     </li>
    </ul>
   </n-collapse-item>
  </n-collapse>
 </n-card>
</template>

<style scoped>
.scene-interactions-toolbar,.interaction-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px 16px}
.scene-interactions-toolbar{align-items:end;margin-bottom:18px}
.scene-interactions-toolbar>button{justify-self:start}
.interaction-fields :deep(.n-input-number){width:100%}
.remove-interaction{margin-top:12px}
.missing-scene{color:#a54e27}
.built-in-interactions{margin-top:16px}
.built-in-list{display:grid;gap:8px;padding:0;list-style:none}
.built-in-list li{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 12px}
.built-in-list small{color:#536a60;overflow-wrap:anywhere}
</style>
