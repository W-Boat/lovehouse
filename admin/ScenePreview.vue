<script setup>
import {NRadioButton,NRadioGroup,NTag} from 'naive-ui';
import {PublisherAlert} from './publisher-components.js';
import {computed,ref,watch} from 'vue';

const props=defineProps({scene:{type:Object,required:true}});
const emit=defineEmits(['update:scene']);
const mode=ref('view');
const failed=ref(false);
const background=computed(()=>{
 const value=props.scene?.background;
 if(typeof value!=='string'||value.length>2048||/[<>"'\s]/.test(value))return '';
 try{
  const url=new URL(value);
  return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';
 }catch{return ''}
});
watch(background,()=>{failed.value=false});
const point=value=>Array.isArray(value)&&value.length===2&&value.every(Number.isFinite)?value:undefined;
const spawn=computed(()=>point(props.scene.spawn));
const exit=computed(()=>point(props.scene.exit));
const floor=computed(()=>{
 const value=props.scene.floor;
 if(!Array.isArray(value))return;
 const values=value.flat();
 if(values.length!==4||!values.every(Number.isFinite))return;
 const [left,top,right,bottom]=values;
 if(right<=left||bottom<=top)return;
 return {x:left,y:top,width:right-left,height:bottom-top};
});
const invalidPoints=computed(()=>{
 if(!floor.value)return [];
 const {x,y,width,height}=floor.value;
 return [['到达点',spawn.value],['返回点',exit.value]].filter(([,p])=>p&&(p[0]<x||p[0]>x+width||p[1]<y||p[1]>y+height)).map(([label])=>label);
});
function place(event){
 if(mode.value==='view'||event.button!==0)return;
 const bounds=event.currentTarget.getBoundingClientRect();
 if(!bounds.width||!bounds.height)return;
 const x=Math.max(0,Math.min(640,Math.round((event.clientX-bounds.left)/bounds.width*640)));
 const y=Math.max(0,Math.min(426,Math.round((event.clientY-bounds.top)/bounds.height*426)));
 emit('update:scene',{...props.scene,[mode.value]:[x,y]});
}
</script>

<template>
 <section class="scene-preview" aria-label="场景点位预览">
  <div class="scene-preview-toolbar">
   <n-radio-group v-model:value="mode" size="small" aria-label="点位编辑模式">
    <n-radio-button value="view">只预览</n-radio-button>
    <n-radio-button value="spawn">设置到达点</n-radio-button>
    <n-radio-button value="exit">设置返回点</n-radio-button>
   </n-radio-group>
   <n-tag effect="plain" type="info">640 × 426</n-tag>
  </div>
  <p class="scene-preview-help">{{mode==='view'?'绿色范围可行走，蓝色为到达点，橙色为返回点。':'点击背景设置点位，也可用上方坐标输入框精确调整。'}} 父场景入口在父场景中设置。</p>
  <div class="scene-preview-stage" :class="{'scene-preview-editing':mode!=='view'}">
   <img v-if="background&&!failed" :src="background" alt="场景背景" referrerpolicy="no-referrer" @error="failed=true">
   <div v-else class="scene-preview-placeholder">{{failed?'背景暂时无法加载':'填写 HTTPS 背景地址后预览'}}</div>
   <svg viewBox="0 0 640 426" preserveAspectRatio="none" role="img" aria-label="可行走范围与角色点位" @pointerdown="place">
    <rect v-if="floor" v-bind="floor" fill="#48b58b" fill-opacity=".18" stroke="#36b37e" stroke-width="2" stroke-dasharray="7 5"/>
    <g v-if="spawn" :transform="'translate('+spawn[0]+','+spawn[1]+')'">
     <circle r="7" fill="#3c8fff" stroke="#fff" stroke-width="2"/><text x="11" y="-10">到达 {{spawn[0]}}, {{spawn[1]}}</text>
    </g>
    <g v-if="exit" :transform="'translate('+exit[0]+','+exit[1]+')'">
     <circle r="7" fill="#e49734" stroke="#fff" stroke-width="2"/><text x="11" y="15">返回 {{exit[0]}}, {{exit[1]}}</text>
    </g>
   </svg>
  </div>
  <publisher-alert v-if="invalidPoints.length" :title="invalidPoints.join('、')+'在行走范围外，请调整后发布。'" type="warning" :closable="false" show-icon/>
 </section>
</template>

<style scoped>
.scene-preview{grid-column:1/-1;display:grid;gap:10px;padding:14px;border:1px solid var(--n-border-color);border-radius:8px;background:var(--n-fill-color-light)}
.scene-preview-toolbar{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center}
.scene-preview-help{margin:0;color:var(--n-text-color-secondary);font-size:13px;line-height:1.6}
.scene-preview-stage{position:relative;width:100%;max-width:760px;aspect-ratio:640/426;overflow:hidden;background:#edf1ec;border-radius:6px}
.scene-preview-stage>img,.scene-preview-stage>svg,.scene-preview-placeholder{position:absolute;inset:0;width:100%;height:100%}
.scene-preview-stage>img{object-fit:fill}
.scene-preview-stage>svg{touch-action:manipulation}
.scene-preview-editing>svg{cursor:crosshair}
.scene-preview-placeholder{display:grid;place-items:center;color:#68776d;font-size:14px;text-align:center;padding:16px}
.scene-preview-stage text{fill:#fff;stroke:#20342d;stroke-width:3px;paint-order:stroke;font-size:13px;font-weight:600}
</style>
