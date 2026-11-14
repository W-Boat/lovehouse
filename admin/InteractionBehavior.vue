<script setup>
import {NForm,NInput} from 'naive-ui';
import {PublisherAlert,PublisherFormItem,PublisherOption,PublisherSelect} from './publisher-components.js';
import {computed} from 'vue';

const props=defineProps({modelValue:{type:Object,default:()=>({})}});
const emit=defineEmits(['update:modelValue']);
const record=computed(()=>props.modelValue&&typeof props.modelValue==='object'&&!Array.isArray(props.modelValue)?props.modelValue:{});
const destinationKeys=['game','gameUrl','url'];
const types=[
 {value:'message',label:'显示场景短句'},
 {value:'builtin',label:'打开内置小游戏'},
 {value:'external',label:'打开独立小游戏'},
 {value:'page',label:'打开网页'},
];
const games=[
 ['moon','月光拼装'],['keychain','文字连接'],['chestnuts','接栗子'],['earphones','三轨节奏'],
 ['band','散步路线'],['doll','抓娃娃'],['chocolate','礼盒装填'],['letter','信笺修复'],
 ['notes','心意排序'],['hat','编织猫耳'],['labubu','盲盒机关'],['mystery','双人合作机关'],
];
const behavior=computed(()=>record.value.game!==undefined?'builtin':record.value.gameUrl!==undefined?'external':record.value.url!==undefined?'page':'message');
const field=computed(()=>({builtin:'game',external:'gameUrl',page:'url'})[behavior.value]);
const conflicting=computed(()=>destinationKeys.filter(key=>record.value[key]!==undefined).length>1);
function choose(value){
 const next={...record.value};
 const key=({builtin:'game',external:'gameUrl',page:'url'})[value];
 const previous=key?next[key]:undefined;
 for(const name of destinationKeys)delete next[name];
 if(key)next[key]=previous??(key==='game'?'moon':'');
 emit('update:modelValue',next);
}
function update(value){
 const next={...record.value};
 for(const name of destinationKeys)delete next[name];
 if(field.value)next[field.value]=value;
 emit('update:modelValue',next);
}
const urlError=computed(()=>{
 if(!['external','page'].includes(behavior.value))return '';
 const value=record.value[field.value];
 if(typeof value!=='string'||!value.trim())return '请填写 HTTPS 地址';
 if(value.length>2048||/[<>"'\s]/.test(value))return '地址格式无效';
 try{
  const url=new URL(value);
  if(url.protocol==='https:'&&!url.username&&!url.password)return '';
 }catch{}
 return '请输入不含账号密码的 HTTPS 地址';
});
</script>

<template>
 <section class="interaction-behavior">
  <publisher-alert v-if="conflicting" title="此条目包含多个目标。重新选择互动方式可修正为一个目标。" type="warning" :closable="false"/>
  <n-form label-placement="top">
   <publisher-form-item label="互动方式">
    <publisher-select :value="behavior" aria-label="互动方式" @update:value="choose">
     <publisher-option v-for="option in types" :key="option.value" :value="option.value" :label="option.label"/>
    </publisher-select>
   </publisher-form-item>
   <publisher-form-item v-if="behavior==='builtin'" label="内置小游戏" :error="!games.some(([id])=>id===record.game)?'请选择有效的内置小游戏':''">
    <publisher-select :value="record.game" filterable aria-label="内置小游戏" @update:value="update">
     <publisher-option v-for="[id,label] in games" :key="id" :value="id" :label="label+' · '+id"/>
    </publisher-select>
   </publisher-form-item>
   <publisher-form-item v-else-if="behavior==='external'||behavior==='page'" :label="behavior==='external'?'独立小游戏地址':'网页地址'" :error="urlError">
    <n-input :value="record[field]||''" placeholder="https://…" clearable :aria-label="behavior==='external'?'独立小游戏地址':'网页地址'" @update:value="update"/>
   </publisher-form-item>
  </n-form>
  <p v-if="behavior==='message'">点击后显示此条目的反馈短句。</p>
  <p v-else-if="behavior==='builtin'">以内置玩法开启练习，完成后显示反馈短句。</p>
  <p v-else-if="behavior==='external'">在场景内打开独立编写的 HTML 游戏。目标站点需允许 iframe 嵌入。</p>
  <p v-else>在小屋内打开网页，玩家关闭后回到原场景。目标站点需允许 iframe 嵌入。</p>
 </section>
</template>

<style scoped>
.interaction-behavior{grid-column:1/-1;padding:16px;border:1px solid #dce4dc;border-radius:8px;background:#fff}
.interaction-behavior .n-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:14px}
.interaction-behavior .n-form-item{margin-bottom:0}
.interaction-behavior .n-select{width:100%}
.interaction-behavior p{margin:12px 0 0;color:#54665a;font-size:13px;line-height:1.6}
.interaction-behavior .n-alert{margin-bottom:14px}
</style>
