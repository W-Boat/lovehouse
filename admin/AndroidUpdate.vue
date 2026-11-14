<script setup>
import {NButton,NCard,NProgress,NStep,NSteps,NTag} from 'naive-ui';
import {PublisherAlert,PublisherDialog} from './publisher-components.js';
import {computed, ref} from 'vue';

const props=defineProps({token:{type:String,required:true}});
const emit=defineEmits(['updated']);
const base=import.meta.env.BASE_URL+'api/android-update/';
const blobName=/^[a-f0-9]{64}$/;
const numberFormat=new Intl.NumberFormat('zh-CN',{maximumFractionDigits:1});
const folderInput=ref(null);
const draft=ref(null);
const busy=ref(false);
const reading=ref(false);
const confirm=ref(false);
const phase=ref(0);
const sentFiles=ref(0);
const notice=ref(null);
const percentage=computed(()=>{
 if(phase.value===3)return 100;
 if(!draft.value)return 0;
 return Math.floor(sentFiles.value*99/draft.value.blobs.length);
});

function readableBytes(bytes){
 return bytes>=1024*1024
  ?numberFormat.format(bytes/(1024*1024))+' MiB'
  :numberFormat.format(bytes/1024)+' KiB';
}

async function readFolder(event){
 const files=Array.from(event.target.files);
 event.target.value='';
 if(!files.length||busy.value||reading.value)return;
 reading.value=true;
 notice.value=null;
 draft.value=null;
 phase.value=0;
 sentFiles.value=0;
 try{
  const manifests=files.filter(file=>file.name==='update.json'&&!file.webkitRelativePath.includes('/blobs/'));
  if(manifests.length!==1)throw Error('请选择解压后的 lovehouse-content-update 文件夹，目录中应有一份 update.json。');
  const [manifest]=manifests;
  if(manifest.size>3_000_000)throw Error('签名清单超过 3 MB。');
  const folder=manifest.webkitRelativePath.slice(0,-manifest.name.length);
  const blobPath=folder+'blobs/';
  const blobs=files.filter(file=>file.webkitRelativePath===blobPath+file.name&&blobName.test(file.name));
  if(!blobs.length)throw Error('所选文件夹的 blobs 目录没有资源。');
  if(blobs.some(file=>file.size>200_000_000))throw Error('单个资源超过 200 MB。');

  let version;
  try{
   const envelope=JSON.parse(await manifest.text());
   if(typeof envelope.payload!=='string'||typeof envelope.signature!=='string'||!envelope.signature)throw Error();
   const payload=Uint8Array.from(atob(envelope.payload),character=>character.charCodeAt(0));
   version=JSON.parse(new TextDecoder().decode(payload)).version;
   if(!Number.isSafeInteger(version)||version<1||version>2147483647)throw Error();
  }catch{
   throw Error('无法读取版本号。请选择 Actions 生成的原始签名清单。');
  }
  const bytes=blobs.reduce((total,file)=>total+file.size,manifest.size);
  draft.value={folder:folder.replace(/\/$/,''),manifest,blobs,version,bytes};
 }catch(error){
  notice.value={type:'error',text:error.message};
 }finally{
  reading.value=false;
 }
}

function stagePublish(){
 if(!draft.value||busy.value)return;
 if(!props.token.trim()){
  notice.value={type:'error',text:'请先填写发布令牌。'};
  return;
 }
 confirm.value=true;
}

async function publish(){
 confirm.value=false;
 const release=draft.value;
 if(!release||busy.value)return;
 const token=props.token.trim();
 if(!token){
  notice.value={type:'error',text:'请先填写发布令牌。'};
  return;
 }
 notice.value=null;
 busy.value=true;
 sentFiles.value=0;
 phase.value=1;

 async function send(path,file){
  const response=await fetch(base+path,{
   method:'POST',headers:{Authorization:'Bearer '+token},body:file,
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok||!data)throw Error(data?.error??'上传失败（HTTP '+response.status+'）');
  return data;
 }

 try{
  for(const file of release.blobs){
   await send('blobs/'+file.name,file);
   sentFiles.value++;
  }
  phase.value=2;
  const entry=await send('publish',release.manifest);
  phase.value=3;
  draft.value=null;
  notice.value={type:'success',text:'已发布 Android 资源版本 '+entry.version};
  emit('updated',entry);
 }catch(error){
  notice.value={type:'error',text:error.message};
 }finally{
  busy.value=false;
 }
}
</script>

<template>
 <n-card shadow="never" class="resource-card">
  <template #header>
   <div class="resource-heading">
    <h2>发布 Android 增量资源</h2>
    <p>从 GitHub Actions 下载并解压 <code>lovehouse-content-update</code>。发布后，支持热更新的 Android 客户端在下次启动时检查资源。</p>
   </div>
  </template>

  <div class="resource-content">
   <n-steps class="resource-steps" :current="phase+1" :status="notice?.type==='error' && phase>0?'error':'process'" finish-status="success" simple>
    <n-step title="检查目录"/>
    <n-step title="上传资源"/>
    <n-step title="发布清单"/>
   </n-steps>

   <publisher-alert v-if="notice" :title="notice.text" :type="notice.type" show-icon :closable="false"/>

   <div class="folder-choice">
    <div>
     <strong>{{draft?.folder||'签名资源目录'}}</strong>
     <p>{{draft?'目录已读取，发布时由服务器校验签名。':'目录应包含 update.json 和 blobs 文件夹。'}}</p>
    </div>
    <input ref="folderInput" type="file" webkitdirectory multiple hidden :disabled="busy||reading" @change="readFolder">
    <n-button plain :disabled="busy" :loading="reading" @click="folderInput?.click()">
     {{draft?'更换文件夹':'选择文件夹'}}
    </n-button>
   </div>

   <dl v-if="draft" class="manifest-summary">
    <div><dt>资源版本</dt><dd><n-tag effect="light">{{draft.version}}</n-tag></dd></div>
    <div><dt>资源文件</dt><dd>{{numberFormat.format(draft.blobs.length)}} 个</dd></div>
    <div><dt>上传体积</dt><dd>{{readableBytes(draft.bytes)}}</dd></div>
   </dl>

   <div v-if="busy" class="progress-block" role="status">
    <span v-if="phase===1">已上传 {{sentFiles}} / {{draft.blobs.length}} 个资源</span>
    <span v-else>正在校验签名并切换资源版本</span>
    <n-progress type="line" :percentage="percentage"/>
   </div>

   <div class="resource-footer">
    <n-button type="primary" :disabled="!draft||reading||busy" :loading="busy" @click="stagePublish">
     {{phase>0 && notice?.type==='error'?'重试发布':'审核并发布资源'}}
    </n-button>
   </div>
  </div>
 </n-card>

 <publisher-dialog v-model="confirm" title="确认发布 Android 资源" width="min(460px, 94vw)">
  <template v-if="draft">
   <p>资源版本 {{draft.version}} · {{numberFormat.format(draft.blobs.length)}} 个文件 · {{readableBytes(draft.bytes)}}</p>
   <p>资源上传完毕后，服务器将校验签名清单并切换版本。</p>
  </template>
  <template #footer>
   <n-button @click="confirm=false">取消</n-button>
   <n-button type="primary" @click="publish">确认发布</n-button>
  </template>
 </publisher-dialog>
</template>

<style scoped>
.resource-card{min-width:0;--n-card-border-radius:12px;--n-card-padding:18px}
.resource-heading h2{margin:0;font-size:17px}
.resource-heading p,.folder-choice p{margin:6px 0 0;color:var(--n-text-color-secondary);font-size:13px;line-height:1.55}
.resource-heading code{overflow-wrap:anywhere}
.resource-content,.progress-block{display:grid;gap:14px}
.resource-steps{padding:12px}
.resource-steps :deep(.n-step__title){font-size:13px}
.folder-choice{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;padding:16px;border:1px dashed var(--n-border-color);border-radius:8px;background:var(--n-fill-color-lighter);overflow-wrap:anywhere}
.manifest-summary{margin:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.manifest-summary div{min-width:0;padding:10px;border:1px solid var(--n-border-color-lighter);border-radius:8px}
.manifest-summary dt,.progress-block{font-size:13px;color:var(--n-text-color-secondary)}
.manifest-summary dd{margin:6px 0 0;font-weight:600;font-size:14px;overflow-wrap:anywhere}
.progress-block{gap:6px}
.resource-footer{display:flex;justify-content:flex-end}
@media(max-width:560px){
 .resource-card{--n-card-padding:13px}
 .resource-steps{padding:8px}
 .resource-steps :deep(.n-step__arrow){flex-grow:0;width:10px}
 .resource-steps :deep(.n-step__arrow::before),.resource-steps :deep(.n-step__arrow::after){width:4px}
}
@media(max-width:360px){
 .resource-steps :deep(.n-step__head){display:none}
 .resource-steps :deep(.n-step__main){padding-left:0}
 .resource-steps :deep(.n-step__title){font-size:12px}
}
</style>
