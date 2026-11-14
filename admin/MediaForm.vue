<script setup>
import ResourceLink from "./ResourceLink.vue";
import {NButton,NEmpty,NForm,NInput,NTag} from 'naive-ui';
import {PublisherAlert,PublisherDate,PublisherFormItem} from './publisher-components.js';
import {computed,ref} from 'vue';

const model=defineModel({type:Object,default:()=>({})});
const media=computed(()=>model.value&&typeof model.value==='object'&&!Array.isArray(model.value)?model.value:{});
const photos=computed(()=>Array.isArray(media.value.memoryPhotos)?media.value.memoryPhotos:[]);
const errors=ref({});
const imageFields=[
 {key:'moonImage',label:'生日月亮图片',help:'填写已核实日期对应的月亮图片，与下方日期一起显示。'},
 {key:'labubuImage',label:'LABUBU 揭晓图片',help:'用于拆开礼物后的真实款式展示。'},
 {key:'mysteryImage',label:'神秘盒子揭晓图片',help:'用于神秘盒子拆开后的图片展示。'},
];
function update(key,value){model.value={...media.value,[key]:value};errors.value={}}
function useDefault(key){const next={...media.value};delete next[key];model.value=next;errors.value={}}
const configured=key=>Object.hasOwn(media.value,key);
function safeUrl(value){
 if(typeof value!=='string'||value.length>2048||/[<>"'\s]/.test(value))return '';
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:''}catch{return ''}
}
function status(key){return !configured(key)?'使用内置配置':media.value[key]===''?'已明确清除':'已配置'}
function changePhoto(index,value){const next=[...photos.value];next[index]=value;update('memoryPhotos',next)}
function removePhoto(index){update('memoryPhotos',photos.value.filter((_,i)=>i!==index))}
function fail(url){errors.value={...errors.value,[url]:true}}
</script>

<template>
 <div class="media-form">
  <publisher-alert type="info" :closable="false" title="从素材库复制 HTTPS 链接后粘贴。网络素材会在玩家打开对应内容时加载。"/>
  <n-form label-placement="top" class="media-fields">
   <section class="media-card date-card">
    <div class="media-label"><h3>月亮对应的出生日期</h3><n-tag type="info" size="small">{{status('birthDateForMoon')}}</n-tag></div>
    <publisher-form-item label="出生日期">
     <publisher-date :model-value="media.birthDateForMoon||null" type="date" value-format="YYYY-MM-DD" format="YYYY-MM-DD" placeholder="选择已确认的日期" aria-label="月亮对应的出生日期" @update:model-value="update('birthDateForMoon',$event||'')"/>
    </publisher-form-item>
    <p>请按真实生日填写，客户端不会根据日期生成或推断月相。</p>
    <n-button v-if="configured('birthDateForMoon')" text @click="useDefault('birthDateForMoon')">恢复内置配置</n-button>
   </section>
   <section v-for="field in imageFields" :key="field.key" class="media-card">
    <div class="media-label"><h3>{{field.label}}</h3><n-tag type="info" size="small">{{status(field.key)}}</n-tag></div>
    <p>{{field.help}}</p>
    <publisher-form-item :label="field.label+'链接'" :error="media[field.key]&&!safeUrl(media[field.key])?'请输入不含账号密码的 HTTPS 地址':''">
     <ResourceLink accept="image/*" :value="media[field.key]||''" clearable placeholder="https://…" :aria-label="field.label+'链接'" @update:value="update(field.key,$event)"/>
    </publisher-form-item>
    <div v-if="safeUrl(media[field.key])" class="media-preview">
     <img v-if="!errors[safeUrl(media[field.key])]" :key="safeUrl(media[field.key])" :src="safeUrl(media[field.key])" :alt="field.label+'预览'" loading="lazy" referrerpolicy="no-referrer" @error="fail(safeUrl(media[field.key]))">
     <publisher-alert v-else type="warning" :closable="false" title="图片暂时无法预览，请检查链接或素材服务。"/>
    </div>
    <n-button v-if="configured(field.key)" text @click="useDefault(field.key)">恢复内置配置</n-button>
   </section>
   <section class="media-card">
    <div class="media-label"><h3>火星演唱会音源</h3><n-tag type="info" size="small">{{status('concertAudio')}}</n-tag></div>
    <publisher-form-item label="演唱会音频链接" :error="media.concertAudio&&!safeUrl(media.concertAudio)?'请输入不含账号密码的 HTTPS 地址':''">
     <ResourceLink accept="audio/*" :value="media.concertAudio||''" clearable placeholder="https://…" aria-label="演唱会音频链接" @update:value="update('concertAudio',$event)"/>
    </publisher-form-item>
    <audio v-if="safeUrl(media.concertAudio)" :key="safeUrl(media.concertAudio)" :src="safeUrl(media.concertAudio)" controls preload="none" aria-label="演唱会音频预览" @error="fail(safeUrl(media.concertAudio))"/>
    <publisher-alert v-if="errors[safeUrl(media.concertAudio)]" type="warning" :closable="false" title="音频暂时无法播放，请检查链接或格式。"/>
    <n-button v-if="configured('concertAudio')" text @click="useDefault('concertAudio')">恢复内置配置</n-button>
   </section>
   <section class="media-card photo-card">
    <div class="media-label"><h3>回忆照片</h3><n-tag type="info" size="small">{{photos.length}} / 24</n-tag></div>
    <p>照片按列表顺序用于回忆放映。最多 24 张，新增后请填写完整链接再发布。</p>
    <div v-for="(photo,index) in photos" :key="index" class="photo-row">
     <div class="photo-thumb">
      <img v-if="safeUrl(photo)&&!errors[safeUrl(photo)]" :src="safeUrl(photo)" :alt="'回忆照片 '+(index+1)" loading="lazy" referrerpolicy="no-referrer" @error="fail(safeUrl(photo))">
      <span v-else>{{index+1}}</span>
     </div>
     <publisher-form-item :label="'照片 '+(index+1)" :error="!safeUrl(photo)?'请填写有效 HTTPS 地址':errors[safeUrl(photo)]?'图片暂时无法预览':''">
      <ResourceLink accept="image/*" :value="photo" placeholder="https://…" :aria-label="'照片 '+(index+1)+' 链接'" @update:value="changePhoto(index,$event)"/>
     </publisher-form-item>
     <n-button text type="error" @click="removePhoto(index)">移除</n-button>
    </div>
    <n-empty v-if="!photos.length" description="暂无云端回忆照片" :image-size="52"/>
    <div class="photo-actions"><n-button :disabled="photos.length>=24" @click="update('memoryPhotos',[...photos,''])">添加照片</n-button><n-button v-if="configured('memoryPhotos')" text @click="useDefault('memoryPhotos')">恢复内置配置</n-button></div>
   </section>
  </n-form>
 </div>
</template>

<style scoped>
.media-form{display:grid;gap:18px}.media-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:16px}.media-card{min-width:0;padding:18px;border:1px solid #dce4dc;border-radius:10px;background:#f7f9f6}.media-label{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.media-label h3{font-size:16px;margin:0}.media-card p{font-size:13px;line-height:1.6;color:#54665a;margin:10px 0 14px}.date-card .n-form-item{margin-top:16px}.media-preview{min-height:90px;display:grid;place-items:center;background:#edf2eb;border-radius:7px;padding:10px;margin-bottom:8px}.media-preview img{display:block;max-width:100%;max-height:180px;object-fit:contain}.media-card audio{display:block;max-width:100%;width:100%;margin-bottom:10px}.photo-card{grid-column:1/-1}.photo-row{display:grid;grid-template-columns:60px minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid #dce4dc}.photo-row .n-form-item{margin:0 0 15px}.photo-thumb{width:60px;height:60px;display:grid;place-items:center;border-radius:7px;overflow:hidden;background:#e5ece3;color:#54665a}.photo-thumb img{width:100%;height:100%;object-fit:contain}.photo-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.photo-actions .n-button+.n-button{margin-left:0}@media(max-width:480px){.photo-row{grid-template-columns:44px minmax(0,1fr);gap:8px}.photo-thumb{width:44px;height:44px}.photo-row>.n-button{grid-column:2;justify-self:end}}
</style>
