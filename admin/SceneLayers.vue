<script setup>
import {computed} from 'vue';
import {NButton,NCard,NForm,NFormItem,NInput,NInputNumber,NSelect,NSwitch,NCollapse,NCollapseItem} from 'naive-ui';
import ResourceLink from './ResourceLink.vue';
const props=defineProps({modelValue:Array,interactions:{type:Array,default:()=>[]},zone:String,maxLayers:{type:Number,default:40}});
const emit=defineEmits(['update:modelValue']);
const layers=computed(()=>props.modelValue??[]);
const triggerOptions=computed(()=>props.interactions.filter(item=>item.zone===props.zone).map(item=>({value:item.id,label:item.name||item.id})));
const fields=[['x','X',-640,1280],['y','Y',-426,852],['width','宽度',1,1280],['height','高度',1,852],['depth','前后层级',0,30]];
function set(index,key,value){
 const next=layers.value.map(layer=>({...layer}));
 if(value===null||value===undefined)delete next[index][key];else next[index][key]=value;
 emit('update:modelValue',next);
}
function frames(index,key,value){set(index,'frames',{...layers.value[index].frames,[key]:value})}
function path(index,key,value){set(index,'path',{...layers.value[index].path,[key]:value})}
function coordinate(index,point,axis,value){
 const points=layers.value[index].path.points.map(p=>[...p]);points[point][axis]=value;path(index,'points',points);
}
function add(){
 emit('update:modelValue',[...layers.value,{id:'layer-'+crypto.randomUUID().slice(0,8),src:'',x:320,y:213,width:64,height:64,depth:3,autoplay:true}]);
}
</script>
<template>
 <n-card title="动态分层与互动动画" size="small">
  <p>素材使用透明图片或等尺寸帧图集。每层可设置循环动画、移动路线和点击触发。</p>
  <n-button size="small" :disabled="layers.length>=maxLayers" @click="add">添加图层</n-button>
  <n-collapse>
   <n-collapse-item v-for="(layer,index) in layers" :key="index" :title="layer.id" :name="index">
    <n-form label-placement="top">
     <n-form-item label="图层 ID"><n-input :value="layer.id" @update:value="set(index,'id',$event)"/></n-form-item>
     <n-form-item label="图片或帧图集"><ResourceLink :value="layer.src" accept="image/png,image/webp,image/jpeg,image/avif" @update:value="set(index,'src',$event)"/></n-form-item>
     <div class="layer-fields">
      <n-form-item v-for="[key,label,min,max] in fields" :key="key" :label="label"><n-input-number :value="layer[key]" :min="min" :max="max" @update:value="set(index,key,$event)"/></n-form-item>
     </div>
     <n-form-item label="进入场景后自动播放"><n-switch :value="layer.autoplay" @update:value="set(index,'autoplay',$event)"/></n-form-item>
     <n-form-item label="点击此场景互动点时重播"><n-select :value="layer.trigger??null" :options="triggerOptions" clearable @update:value="set(index,'trigger',$event)"/></n-form-item>
     <n-form-item label="使用帧图集"><n-switch :value="Boolean(layer.frames)" @update:value="set(index,'frames',$event?{columns:4,rows:4,fps:8,loop:true}:undefined)"/></n-form-item>
     <div v-if="layer.frames" class="layer-fields">
      <n-form-item v-for="[key,label,max] in [['columns','列数',16],['rows','行数',16],['fps','每秒帧数',24]]" :key="key" :label="label"><n-input-number :value="layer.frames[key]" :min="1" :max="max" :precision="0" @update:value="frames(index,key,$event)"/></n-form-item>
      <n-form-item label="循环"><n-switch :value="layer.frames.loop" @update:value="frames(index,'loop',$event)"/></n-form-item>
     </div>
     <n-form-item label="使用移动路线"><n-switch :value="Boolean(layer.path)" @update:value="set(index,'path',$event?{points:[[layer.x,layer.y],[layer.x+40,layer.y]],seconds:5}:undefined)"/></n-form-item>
     <template v-if="layer.path">
      <n-form-item label="一次行程的秒数"><n-input-number :value="layer.path.seconds" :min=".5" :max="300" @update:value="path(index,'seconds',$event)"/></n-form-item>
      <div v-for="(point,i) in layer.path.points" :key="i" class="layer-fields">
       <n-form-item v-for="axis in [0,1]" :key="axis" :label="'路径点 '+(i+1)+(axis?' Y':' X')"><n-input-number :value="point[axis]" :min="axis?-426:-640" :max="axis?852:1280" @update:value="coordinate(index,i,axis,$event)"/></n-form-item>
       <n-button :disabled="layer.path.points.length<=2" @click="path(index,'points',layer.path.points.filter((_,n)=>n!==i))">移除路径点</n-button>
      </div>
      <n-button :disabled="layer.path.points.length>=16" @click="path(index,'points',[...layer.path.points,[...layer.path.points.at(-1)]])">添加路径点</n-button>
     </template>
     <n-button type="error" text @click="emit('update:modelValue',layers.filter((_,n)=>n!==index))">删除图层</n-button>
    </n-form>
   </n-collapse-item>
  </n-collapse>
 </n-card>
</template>
<style scoped>
.layer-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;align-items:center}
.layer-fields :deep(.n-input-number){width:100%}
</style>
