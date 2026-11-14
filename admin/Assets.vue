<script setup>
import {NButton,NInput,NPagination,NProgress,NTag} from 'naive-ui';
import {PublisherAlert,PublisherColumn,PublisherDialog,PublisherOption,PublisherSelect,PublisherTable} from './publisher-components.js';
import {computed,onBeforeUnmount,ref,watch} from 'vue';

import {NCard} from 'naive-ui';
const gallery=ref(true);
const props=defineProps({token:{type:String,required:true}});
const assets=ref([]),busy=ref(false),loaded=ref(false);
const notice=ref(''),failed=ref(false),selected=ref(null),preview=ref(null);
const references=ref([]),referenceAsset=ref(null),referenceBusy=ref(false);
const search=ref(''),category=ref('all'),page=ref(1),pageSize=ref(12);
const uploadName=ref(''),uploadIndex=ref(0),uploadTotal=ref(0),uploadPercent=ref(0);
const uploads=ref([]),lyrics=ref(''),previewError=ref(''),previewLoading=ref(false);
let uploadRequest,previewController;
let disposed=false;
const assetUrl=asset=>new URL(asset.path,location.origin).href;
const kind=asset=>asset.mime?.startsWith('image/')?'image':asset.mime?.startsWith('audio/')?'audio':asset.mime?.startsWith('text/plain')?'lyrics':'other';
const labels={image:'图片',audio:'音频',lyrics:'歌词',other:'其他'};
const totalBytes=computed(()=>assets.value.reduce((total,asset)=>total+asset.bytes,0));
const filtered=computed(()=>{
 const query=search.value.trim().toLowerCase();
 return assets.value.filter(asset=>(category.value==='all'||kind(asset)===category.value)&&
  (!query||asset.name.toLowerCase().includes(query)||asset.id.includes(query)));
});
const rows=computed(()=>filtered.value.slice((page.value-1)*pageSize.value,page.value*pageSize.value));
const uploadActive=computed(()=>Boolean(uploadName.value));
const formatSize=value=>value>=1024*1024?(value/1024/1024).toFixed(1)+' MB':(value/1024).toFixed(1)+' KB';
watch([search,category,pageSize],()=>{page.value=1});
watch(()=>filtered.value.length,length=>{page.value=Math.min(page.value,Math.max(1,Math.ceil(length/pageSize.value)))});

function message(text,error=false){notice.value=text;failed.value=error}
function authorization(){
 if(!props.token.trim())throw Error('请输入发布令牌');
 return 'Bearer '+props.token.trim();
}
async function call(method,path='',body){
 const response=await fetch(import.meta.env.BASE_URL+'api/assets'+path,{
  method,body,headers:{Authorization:authorization()},
 });
 const data=await response.json();
 if(!response.ok)throw Error(data.error||'素材请求失败');
 return data;
}
async function run(action){
 if(busy.value)return;
 busy.value=true;notice.value='';failed.value=false;
 try{await action()}catch(error){if(!disposed)message(error.message,true)}
 finally{busy.value=false}
}
async function load(){
 const [online,catalog]=await Promise.all([call('GET'),fetch(import.meta.env.BASE_URL+'api/bundled',{headers:{Authorization:authorization()}})]);
 assets.value=[...online.assets,...(catalog.ok?(await catalog.json()).assets:[])];
 loaded.value=true;
}
function uploadOne(file){
 return new Promise((resolve,reject)=>{
  const request=new XMLHttpRequest();
  uploadRequest=request;
  request.open('POST',import.meta.env.BASE_URL+'api/assets');
  request.timeout=120000;
  request.setRequestHeader('Authorization',authorization());
  request.setRequestHeader('X-Asset-Name',encodeURIComponent(file.name));
  request.setRequestHeader('Content-Type',file.type||'application/octet-stream');
  request.upload.onprogress=event=>{
   if(event.lengthComputable)uploadPercent.value=Math.round(event.loaded/event.total*100);
  };
  request.onload=()=>{
   let data;
   try{data=JSON.parse(request.responseText)}catch{reject(Error('服务器返回了无法识别的响应'));return}
   if(request.status>=200&&request.status<300)resolve(data.asset);
   else reject(Error(data.error||'上传失败（'+request.status+'）'));
  };
  request.onerror=()=>reject(Error('网络中断，请重试此文件'));
  request.ontimeout=()=>reject(Error('上传超时，请重试此文件'));
  request.onabort=()=>reject(Error('上传已取消'));
  request.send(file);
 });
}
function upload(event){
 const files=[...event.target.files];event.target.value='';
 if(!files.length)return;
 return run(async()=>{
  authorization();
  uploads.value=[];uploadTotal.value=files.length;
  for(const [index,file] of files.entries()){
   if(disposed)break;
   uploadIndex.value=index+1;uploadName.value=file.name;uploadPercent.value=0;
   try{
    const suffix=file.name.split('.').at(-1).toLowerCase();
    if(!['png','jpg','jpeg','webp','avif','mp3','wav','ogg','m4a','lrc'].includes(suffix))throw Error('请选择支持的图片、音频或 LRC 文件');
    if(!file.size||file.size>(suffix==='lrc'?512*1024:16*1024*1024))throw Error(suffix==='lrc'?'歌词文件须为 1 字节至 512 KB':'单文件须为 1 字节至 16 MB');
    const asset=await uploadOne(file);
    const existing=assets.value.findIndex(item=>item.id===asset.id);
    if(existing<0)assets.value.unshift(asset);
    else assets.value.splice(existing,1,asset);
    uploads.value.push({name:file.name,ok:true,text:'已上传'});
   }catch(error){
    if(!disposed)uploads.value.push({name:file.name,ok:false,text:error.message});
   }finally{uploadRequest=undefined}
  }
  uploadName.value='';loaded.value=true;
  const count=uploads.value.filter(item=>item.ok).length;
  message('本次上传完成 '+count+' / '+uploads.value.length+' 个文件',count!==uploads.value.length);
 });
}
function remove(){
 const asset=selected.value;selected.value=null;
 if(!asset)return;
 return run(async()=>{
  await call('DELETE','/'+encodeURIComponent(asset.id));
  assets.value=assets.value.filter(item=>item.id!==asset.id);
  if(preview.value?.id===asset.id)preview.value=null;
  message('已删除 '+asset.name);
 });
}
async function inspectReferences(asset){
 referenceAsset.value=asset;references.value=[];referenceBusy.value=true;
 try{
  const response=await fetch(import.meta.env.BASE_URL+'api/assets/'+asset.id+'/references',{headers:{Authorization:authorization()}});
  const data=await response.json();if(!response.ok)throw Error(data.error);
  references.value=data.references;
 }catch(error){message(error.message,true);referenceAsset.value=null}
 finally{referenceBusy.value=false}
}
async function copy(asset){
 try{await navigator.clipboard.writeText(assetUrl(asset));message('素材链接已复制')}
 catch{message('无法访问剪贴板，请选中链接后手动复制',true)}
}
async function showPreview(asset){
 previewController?.abort();
 preview.value=asset;lyrics.value='';previewError.value='';previewLoading.value=false;
 if(kind(asset)!=='lyrics')return;
 const controller=new AbortController();previewController=controller;
 previewLoading.value=true;
 try{
  const response=await fetch(assetUrl(asset),{signal:controller.signal,credentials:'omit'});
  if(!response.ok)throw Error('歌词暂时无法读取');
  const text=await response.text();
  if(previewController===controller)lyrics.value=text;
 }catch(error){if(previewController===controller&&!controller.signal.aborted)previewError.value=error.message}
 finally{if(previewController===controller)previewLoading.value=false}
}
function closePreview(){previewController?.abort();preview.value=null}
onBeforeUnmount(()=>{disposed=true;uploadRequest?.abort();previewController?.abort()});
</script>

<template>
 <div class="asset-summary"><n-button size="small" @click="gallery=!gallery">{{gallery?'列表视图':'缩略图视图'}}</n-button><span>{{assets.length}} 个素材</span><span>{{formatSize(totalBytes)}}</span><span>单文件上限 16 MB，歌词上限 512 KB</span></div>
 <div class="asset-toolbar">
  <n-input v-model:value="search" clearable placeholder="搜索文件名或素材 ID" aria-label="搜索素材" class="asset-search"/>
  <publisher-select v-model:value="category" aria-label="素材类型" class="asset-category"><publisher-option label="全部类型" value="all"/><publisher-option v-for="(label,value) in labels" :key="value" :label="label" :value="value"/></publisher-select>
  <label class="import" :class="{disabled:busy}">上传素材<input type="file" multiple :disabled="busy" accept="image/png,image/jpeg,image/webp,image/avif,.mp3,.wav,.ogg,.m4a,.lrc" @change="upload"></label>
  <n-button :disabled="busy" @click="run(load)">刷新列表</n-button>
 </div>
 <publisher-alert v-if="notice" :title="notice" :type="failed?'error':'success'" :closable="false" show-icon />
 <section v-if="uploadActive" class="asset-upload-progress" aria-live="polite">
  <div>正在上传 {{uploadIndex}} / {{uploadTotal}} · {{uploadName}}</div><n-progress type="line" :percentage="uploadPercent"/>
 </section>
 <details v-if="uploads.length" class="asset-upload-results"><summary>本次上传结果</summary><div v-for="(item,index) in uploads" :key="index"><n-tag :type="item.ok?'success':'danger'" size="small">{{item.ok?'成功':'失败'}}</n-tag><span>{{item.name}}</span><small>{{item.text}}</small></div></details>
 <div v-if="gallery" class="asset-gallery"><n-card v-for="asset in rows" :key="asset.id" size="small"><button v-if="kind(asset)==='image'" type="button" class="gallery-preview" @click="showPreview(asset)"><img :src="assetUrl(asset)" :alt="asset.name" loading="lazy"></button><strong>{{asset.name}}</strong><p>{{asset.source==='bundled'?'包内':'云端'}} · {{formatSize(asset.bytes)}}</p><n-button size="small" @click="showPreview(asset)">预览</n-button> <n-button size="small" @click="copy(asset)">复制链接</n-button></n-card></div>
 <publisher-table v-else :data="rows" :empty-text="loaded?'没有匹配的素材':'点击刷新列表，读取已上传素材'" class="asset-table">
  <publisher-column label="素材" min-width="200"><template #default="{row}"><div class="asset-name"><button v-if="kind(row)==='image'" type="button" class="asset-thumbnail" :aria-label="'预览 '+row.name" @click="showPreview(row)"><img :src="assetUrl(row)" alt="" loading="lazy"></button><div><strong>{{row.name}}<small v-if="row.source==='bundled'"> · 包内</small></strong><small>{{labels[kind(row)]}} · {{formatSize(row.bytes)}}</small></div></div></template></publisher-column>
  <publisher-column label="链接" min-width="190"><template #default="{row}"><n-input :value="assetUrl(row)" readonly aria-label="素材地址" @focus="event=>event.target.select()"/></template></publisher-column>
  <publisher-column label="操作" width="220"><template #default="{row}"><n-button text @click="showPreview(row)">预览</n-button><n-button text @click="copy(row)">复制</n-button><n-button text @click="inspectReferences(row)">引用</n-button><n-button text type="error" :disabled="busy" v-if="row.source!=='bundled'" @click="selected=row">删除</n-button></template></publisher-column>
 </publisher-table>
 <n-pagination v-if="filtered.length" v-model:page="page" v-model:page-size="pageSize" :page-sizes="[12,24,48]" :item-count="filtered.length" show-size-picker class="asset-pagination"/>
 <publisher-dialog :model-value="Boolean(referenceAsset)" title="素材引用" width="min(720px,94vw)" @close="referenceAsset=null">
  <p>{{referenceAsset?.name}}</p><p v-if="referenceBusy">正在读取引用…</p>
  <publisher-table v-else :data="references" empty-text="当前配置和历史版本均未引用此素材">
   <publisher-column label="版本" width="170"><template #default="{row}">{{row.revision.slice(0,12)}} {{row.current?'· 当前':''}}</template></publisher-column>
   <publisher-column prop="path" label="配置位置"/>
  </publisher-table>
 </publisher-dialog>
 <publisher-dialog :model-value="Boolean(selected)" title="删除此素材？" width="min(440px, 94vw)" @close="selected=null">
  <p>{{selected?.name}}</p><p>已被发布版本引用的素材会保留。</p><template #footer><n-button @click="selected=null">取消</n-button><n-button type="error" @click="remove">确认删除</n-button></template>
 </publisher-dialog>
 <publisher-dialog :model-value="Boolean(preview)" :title="preview?.name" width="min(820px, 94vw)" destroy-on-close @close="closePreview">
  <template v-if="preview">
   <div v-if="kind(preview)==='image'" class="asset-image-preview"><img :src="assetUrl(preview)" :alt="preview.name" @error="previewError='图片暂时无法显示'"></div>
   <audio v-else-if="kind(preview)==='audio'" :key="preview.id" :src="assetUrl(preview)" controls preload="metadata" class="asset-audio-preview" @error="previewError='此音频暂时无法播放'"/>
   <pre v-else class="asset-lyrics-preview">{{previewLoading?'正在读取歌词…':lyrics}}</pre>
   <publisher-alert v-if="previewError" :title="previewError" type="error" :closable="false" show-icon/>
   <n-input :value="assetUrl(preview)" readonly aria-label="预览素材地址" @focus="event=>event.target.select()"/>
  </template>
  <template #footer><n-button @click="closePreview">关闭</n-button><n-button type="primary" @click="copy(preview)">复制链接</n-button></template>
 </publisher-dialog>
</template>

<style scoped>
.asset-summary,.asset-toolbar{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.asset-summary{color:#607066;font-size:13px}.asset-summary span:first-child{color:#263d30;font-weight:600}.asset-search{flex:1;min-width:180px}.asset-category{width:130px}.asset-upload-progress{padding:14px;border:1px solid #dce4dc;border-radius:8px;background:#f7f9f6;font-size:13px}.asset-upload-progress>div:first-child{overflow-wrap:anywhere;margin-bottom:9px}.asset-upload-results{font-size:13px;padding:10px 0}.asset-upload-results summary{cursor:pointer;color:#53695b}.asset-upload-results>div{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:7px 0;overflow-wrap:anywhere}.asset-upload-results small{color:#607066}.asset-name{min-width:0;display:flex;align-items:center;gap:10px}.asset-name small{display:block;color:#607066}.asset-name strong{overflow-wrap:anywhere}.asset-thumbnail{background:#edf1eb;border:1px solid #dce4dc;border-radius:5px;display:flex;align-items:center;justify-content:center;width:48px;height:48px;flex-shrink:0;padding:0;cursor:pointer}.asset-thumbnail img{width:44px;height:44px;object-fit:contain}.asset-pagination{justify-content:flex-end;max-width:100%;overflow:auto}.asset-image-preview{display:grid;place-items:center;min-height:150px;padding:12px;margin-bottom:14px;border-radius:8px;background:repeating-conic-gradient(#e8ede7 0% 25%,#f8faf6 0% 50%) 0/20px 20px}.asset-image-preview img{max-width:100%;max-height:60vh;object-fit:contain}.asset-audio-preview{width:100%;margin:12px 0 24px}.asset-lyrics-preview{max-height:55vh;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f8f3;padding:16px;border:1px solid #dce4dc;border-radius:8px}.asset-table :deep(.n-button+.n-button){margin-left:8px}@media(max-width:690px){.asset-search{flex-basis:100%}.asset-pagination{justify-content:flex-start}}
</style>

<style scoped>
.asset-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}.gallery-preview{width:100%;height:118px;background:#eef2ef;border:0;cursor:pointer;margin-bottom:8px}.gallery-preview img{width:100%;height:100%;object-fit:contain}.asset-gallery strong{display:block;overflow-wrap:anywhere}.asset-gallery p{margin:4px 0 8px}
</style>
