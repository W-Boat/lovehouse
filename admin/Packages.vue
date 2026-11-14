<script setup>
import {NButton,NCard,NEmpty,NForm,NInput,NProgress,NSwitch,NTabPane,NTabs,NTag} from 'naive-ui';
import {PublisherAlert,PublisherColumn,PublisherDialog,PublisherFormItem,PublisherOption,PublisherSelect,PublisherTable} from './publisher-components.js';
import {computed, ref, onMounted} from 'vue';
import AndroidUpdate from './AndroidUpdate.vue';

const props=defineProps({token:{type:String,required:true}});
const emit=defineEmits(['updated']);
const base=import.meta.env.BASE_URL;
const platforms={
 android:{name:'Android', format:'APK', extension:'.apk'},
 windows:{name:'Windows', format:'便携 ZIP', extension:'.zip'},
};
const packageLimit=600*1024*1024;
const versionPattern=/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const formatDate=new Intl.DateTimeFormat('zh-CN',{dateStyle:'medium',timeStyle:'short'});
const formatNumber=new Intl.NumberFormat('zh-CN',{maximumFractionDigits:1});

const tab=ref('packages');
const platform=ref('android');
const version=ref('');
const files=ref([]);
const file=computed(()=>files.value[0]?.raw??null);
const catalog=ref({});
const catalogBusy=ref(false);
const catalogError=ref('');
const history=ref([]);
const historyBusy=ref(false);
const historyLoaded=ref(false);
const historyError=ref('');
const publishing=ref(false);
const switching=ref(false);
const progress=ref(0),phase=ref(''),uploaded=ref(0);
const bucketAvailable=ref(false),direct=ref(false),androidSignOnly=ref(false);
onMounted(()=>{fetch(import.meta.env.BASE_URL+'api/storage/android-bucket',{headers:{Authorization:'Bearer '+props.token}})
 .then(async response=>{if(response.ok){const data=await response.json();androidSignOnly.value=Boolean(data.configuration?.signOnly);if(data.configuration)bucketAvailable.value=true}}).catch(()=>{})});
const notice=ref(null);
const pendingPublish=ref(null);
const pendingSwitch=ref(null);
const busy=computed(()=>publishing.value||switching.value);
const selectedPlatform=computed(()=>platforms[platform.value]);

function readableBytes(bytes){
 if(!Number.isFinite(bytes))return '—';
 if(bytes>=1024*1024)return formatNumber.format(bytes/(1024*1024))+' MiB';
 return formatNumber.format(bytes/1024)+' KiB';
}

function readableDate(value){
 const date=new Date(value);
 return Number.isNaN(date.getTime())?'—':formatDate.format(date);
}

function report(type,text){
 notice.value={type,text};
}

async function readCatalog(){
 if(catalogBusy.value)return;
 catalogBusy.value=true;
 catalogError.value='';
 try{
  const response=await fetch(base+'../packages.json',{cache:'no-store'});
  if(!response.ok)throw Error('无法读取安装包目录');
  catalog.value=await response.json();
 }catch(error){
  catalogError.value=error.message;
 }finally{
  catalogBusy.value=false;
 }
}

async function readHistory(){
 if(historyBusy.value)return;
 historyError.value='';
 const token=props.token.trim();
 if(!token){
  historyError.value='请先填写发布令牌。';
  return;
 }
 historyBusy.value=true;
 try{
  const response=await fetch(base+'api/packages',{headers:{Authorization:'Bearer '+token}});
  const data=await response.json();
  if(!response.ok)throw Error(data.error??'无法读取版本历史');
  history.value=data.releases;
  historyLoaded.value=true;
 }catch(error){
  historyError.value=error.message;
 }finally{
  historyBusy.value=false;
 }
}

function choosePlatform(){
 files.value=[];
 notice.value=null;
}

function chooseFile(event){
 const raw=event.target.files?.[0];event.target.value='';if(!raw)return;
 files.value=[{raw}];checkFile({raw});
}
function suggestedVersion(name){
 return name.match(/(?:^|[-_])([a-f0-9]{7,40}|v?\d+\.\d+(?:\.\d+)?(?:[-_][a-z0-9.-]+)?)\.(?:apk|zip)$/i)?.[1]??'';
}
function checkFile(upload){
 const candidate=upload.raw;
 if(!candidate)return;
 if(!candidate.name.toLowerCase().endsWith(selectedPlatform.value.extension)){
  report('error','请选择 '+selectedPlatform.value.format+' 文件。');
 }else if(candidate.size>packageLimit){
  report('error','安装包超过 600 MiB。');
 }else{
  notice.value=null;
  if(!version.value.trim())version.value=suggestedVersion(candidate.name);
  return;
 }
 files.value=[];
}

function stagePublish(){
 notice.value=null;
 const normalized=version.value.normalize('NFKC').trim();
 if(!props.token.trim()){
  report('error','请先填写发布令牌。');
 }else if(!normalized){
  report('error','请输入安装包版本号，例如 9b1d5d95b526 或 v2.1.0。');
 }else if(!versionPattern.test(normalized)){
  report('error','版本号应为 1 至 64 个字符，以字母或数字开头，可包含点、下划线和连字符。');
 }else if(!file.value){
  report('error','请选择要发布的安装包。');
 }else{
  pendingPublish.value={platform:platform.value,version:normalized,file:file.value,direct:(direct.value&&bucketAvailable.value)||(platform.value==='android'&&androidSignOnly.value)};
 }
}

async function publish(){
 const draft=pendingPublish.value;
 pendingPublish.value=null;
 if(!draft||busy.value)return;
 const token=props.token.trim();
 if(!token){report('error','请先填写发布令牌。');return}
 publishing.value=true;
 progress.value=0;
 try{
  uploaded.value=0;
  const entry=draft.direct?await publishDirect(draft,token):await publishThroughServer(draft,token);
  progress.value=100;
  catalog.value={...catalog.value,[entry.platform]:entry};
  files.value=[];
  version.value='';
  report('success','已发布 '+entry.name);
  emit('updated',{kind:'package',entry});
  await readHistory();
 }catch(error){
  report('error',error.message);
 }finally{
  publishing.value=false;
 }
}

function uploadFile({url,method,file,headers,direct}){
 phase.value=direct?'正在直传储存桶':'正在上传到发布服务器';
 return new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest();
  xhr.open(method,url);
  xhr.timeout=30*60*1000;
  if(!direct)xhr.responseType='json';
  for(const [key,value] of Object.entries(headers))xhr.setRequestHeader(key,value);
  xhr.upload.onprogress=event=>{
   uploaded.value=event.loaded;
   progress.value=Math.min(100,Math.floor(event.loaded*100/file.size));
  };
  xhr.upload.onload=()=>{
   uploaded.value=file.size;
   progress.value=100;
   phase.value=direct?'等待储存桶确认':'服务器正在校验并存储';
  };
  xhr.onload=()=>{
   if(direct?xhr.status>=200&&xhr.status<300:xhr.status===201&&xhr.response)resolve(xhr.response);
   else reject(Error(direct?'储存桶拒绝上传（HTTP '+xhr.status+'）':xhr.response?.error??'上传失败（HTTP '+xhr.status+'）'));
  };
  xhr.onerror=()=>reject(Error(direct?'无法直传储存桶。请检查网络和桶的 CORS，或选择经发布服务器上传。':'上传连接中断'));
  xhr.ontimeout=()=>reject(Error('上传超时'));
  xhr.send(file);
 });
}

function publishThroughServer(draft,token){
 const query=new URLSearchParams({platform:draft.platform,version:draft.version});
 return uploadFile({url:base+'api/packages?'+query,method:'POST',file:draft.file,headers:{Authorization:'Bearer '+token}});
}

async function publishDirect(draft,token){
 phase.value='正在计算文件 SHA-256';
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',await draft.file.arrayBuffer()));
 const sha256=Array.from(digest,value=>value.toString(16).padStart(2,'0')).join('');
 const bytes=draft.file.size;
 const metadata={platform:draft.platform,version:draft.version,sha256,bytes};
 async function request(step){
  const response=await fetch(base+'api/packages/direct/'+step,{
   method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(metadata),
   cache:'no-store',signal:AbortSignal.timeout(step==='finish'?300000:30000),
  });
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'储存桶请求失败');
  return data;
 }
 phase.value='正在请求上传链接';
 const prepared=await request('prepare');
 if(!prepared.exists){
  const url=new URL(prepared.url);
  if(url.protocol!=='https:')throw Error('储存桶上传地址必须使用 HTTPS');
  await uploadFile({url:url.href,method:'PUT',file:draft.file,direct:true,
   headers:{'Content-Type':prepared.contentType,'x-amz-checksum-sha256':btoa(String.fromCharCode(...digest))}});
 }
 progress.value=100;
 uploaded.value=bytes;
 if(prepared.verifyLocally){
  phase.value='正在由本机读回储存桶并校验';
  const fresh=await request('prepare');
  const response=await fetch(fresh.downloadUrl,{cache:'no-store',signal:AbortSignal.timeout(900000)});
  if(!response.ok)throw Error('桶读回失败（HTTP '+response.status+'），请检查桶 CORS');
  const data=await response.arrayBuffer();
  if(data.byteLength!==bytes)throw Error('桶读回文件大小不一致');
  const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),value=>value.toString(16).padStart(2,'0')).join('');
  if(actual!==sha256)throw Error('桶读回 SHA-256 不一致');
  metadata.verifiedLocally=true;
 }else phase.value='服务器正在从桶读回并校验';
 const entry=await request('finish');
 if(entry.sha256!==sha256||entry.bytes!==bytes)throw Error('发布后的安装包校验失败');
 return entry;
}

function stageSwitch(row){
 notice.value=null;
 if(!props.token.trim()){
  report('error','请先填写发布令牌。');
  return;
 }
 pendingSwitch.value=row;
}

async function switchRelease(){
 const row=pendingSwitch.value;
 pendingSwitch.value=null;
 if(!row||busy.value)return;
 const token=props.token.trim();
 if(!token){report('error','请先填写发布令牌。');return}
 switching.value=true;
 try{
  const response=await fetch(base+'api/packages/select',{
   method:'POST',
   headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify({platform:row.platform,path:row.path,expected:catalog.value[row.platform]?.path??null}),
  });
  const data=await response.json();
  if(!response.ok)throw Error(data.error??'无法切换当前安装包');
  catalog.value={...catalog.value,[row.platform]:data};
  report('success','已切换至 '+data.name);
  emit('updated',{kind:'package',entry:data});
  await readHistory();
 }catch(error){
  report('error',error.message);
  await Promise.all([readCatalog(),readHistory()]);
 }finally{
  switching.value=false;
 }
}

void readCatalog();
void fetch(base+'api/storage',{headers:{Authorization:'Bearer '+props.token.trim()},cache:'no-store'})
 .then(async response=>{if(response.ok)bucketAvailable.value=(await response.json()).mode==='s3'})
 .catch(()=>{});
</script>

<template>
 <n-tabs v-model:value="tab" class="release-tabs">
  <n-tab-pane name="packages" tab="客户端安装包">
   <div class="release-stack">
    <publisher-alert v-if="notice" :title="notice.text" :type="notice.type" show-icon :closable="false"/>
    <div class="release-grid">
     <n-card shadow="never" class="release-card">
      <template #header>
       <div class="card-heading">
        <h2>发布安装包</h2>
        <p>上传 Actions 构建的客户端，更新对应平台的下载入口。</p>
       </div>
      </template>
      <n-form label-placement="top" :disabled="busy" @submit.prevent="stagePublish">
       <div class="form-grid">
        <publisher-form-item label="平台">
         <publisher-select v-model:value="platform" aria-label="发布平台" @change="choosePlatform">
          <publisher-option v-for="(entry,key) in platforms" :key="key" :value="key" :label="entry.name+' · '+entry.format"/>
         </publisher-select>
        </publisher-form-item>
        <publisher-form-item label="版本号">
         <n-input v-model:value="version" aria-label="安装包版本号" placeholder="例如 9b1d5d95b526" maxlength="64" autocomplete="off"/>
        </publisher-form-item>
       </div>
       <publisher-form-item label="安装文件">
        <label class="import package-file-picker">点击选择安装包
          <input type="file" :accept="selectedPlatform.extension" :disabled="busy" @change="chooseFile"/>
         </label><small>{{selectedPlatform.format}} · 最大 600 MiB</small>
         <n-button v-if="file" size="small" :disabled="busy" @click="files=[]">移除 {{file.name}}</n-button>
       </publisher-form-item>
       <publisher-form-item v-if="bucketAvailable" label="上传路径">
        <n-switch v-model:value="direct" :disabled="busy"/>
        <span style="margin-left:8px">{{direct?'直传储存桶':'经发布服务器上传'}}</span>
       </publisher-form-item>
       <div class="form-footer">
        <span v-if="file">{{readableBytes(file.size)}}</span>
        <n-button type="primary" attr-type="submit" :loading="publishing" :disabled="busy">审核并发布</n-button>
       </div>
       <div v-if="publishing" class="upload-progress" role="status">
        <span>{{phase}}
        <template v-if="file && (uploaded || phase.startsWith('正在上传') || phase==='正在直传储存桶')"> · {{readableBytes(uploaded)}} / {{readableBytes(file.size)}} · {{progress}}%</template></span>
        <n-progress type="line" :percentage="progress"/>
       </div>
      </n-form>
     </n-card>
     <n-card shadow="never" class="release-card">
      <template #header>
       <div class="card-heading with-action">
        <div><h2>当前版本</h2><p>客户端下载入口</p></div>
        <n-button text :loading="catalogBusy" :disabled="busy" @click="readCatalog">刷新</n-button>
       </div>
      </template>
      <publisher-alert v-if="catalogError" :title="catalogError" type="error" show-icon :closable="false"/>
      <div class="live-list">
       <article v-for="(entry,key) in platforms" :key="key" class="live-package">
        <div class="live-heading">
         <strong>{{entry.name}}</strong>
         <n-tag v-if="catalog[key]" type="success" effect="light">{{catalog[key].version}}</n-tag>
         <n-tag v-else type="info" effect="plain">{{catalogBusy?'读取中':'未发布'}}</n-tag>
        </div>
        <template v-if="catalog[key]">
         <p class="file-name" :title="catalog[key].name">{{catalog[key].name}}</p>
         <p class="metadata">{{readableBytes(catalog[key].bytes)}} · {{readableDate(catalog[key].publishedAt)}}</p>
         <details v-if="catalog[key].sha256" class="checksum">
          <summary>SHA-256</summary>
          <code>{{catalog[key].sha256}}</code>
         </details>
         <n-button tag="a" :href="catalog[key].path" size="small" plain>下载安装包</n-button>
        </template>
        <p v-else class="metadata">{{entry.format}}</p>
       </article>
      </div>
     </n-card>
    </div>
    <n-card shadow="never" class="release-card">
     <template #header>
      <div class="card-heading with-action">
       <div><h2>版本历史</h2><p>需要时可将下载入口切回已上传版本。</p></div>
       <n-button plain :loading="historyBusy" :disabled="busy" @click="readHistory">{{historyLoaded?'刷新历史':'读取历史'}}</n-button>
      </div>
     </template>
     <publisher-alert v-if="historyError" :title="historyError" type="error" show-icon :closable="false"/>
     <n-empty v-if="!history.length && !historyBusy && !historyError" :image-size="56" :description="historyLoaded?'暂无安装包记录':'填写发布令牌后读取版本历史'"/>
     <template v-if="history.length">
      <publisher-table :data="history" row-key="path" class="history-table" aria-label="安装包版本历史">
       <publisher-column label="安装包" min-width="200">
        <template #default="{row}">
         <strong>{{row.version}}</strong>
         <div class="metadata">{{row.name}}</div>
        </template>
       </publisher-column>
       <publisher-column label="大小" width="110">
        <template #default="{row}">{{readableBytes(row.bytes)}}</template>
       </publisher-column>
       <publisher-column label="上传时间" min-width="140">
        <template #default="{row}">{{readableDate(row.publishedAt)}}</template>
       </publisher-column>
       <publisher-column label="状态与操作" width="130">
        <template #default="{row}">
         <n-tag v-if="row.current" type="success" effect="light">当前版本</n-tag>
         <n-button v-else text type="primary" :disabled="busy" @click="stageSwitch(row)">设为当前版本</n-button>
        </template>
       </publisher-column>
      </publisher-table>
      <div class="history-mobile">
       <article v-for="row in history" :key="row.path" class="live-package">
        <div class="live-heading">
         <strong>{{row.version}}</strong>
         <n-tag v-if="row.current" type="success" effect="light">当前版本</n-tag>
        </div>
        <p class="file-name">{{row.name}}</p>
        <p class="metadata">{{readableBytes(row.bytes)}} · {{readableDate(row.publishedAt)}}</p>
        <n-button v-if="!row.current" plain :disabled="busy" @click="stageSwitch(row)">设为当前版本</n-button>
       </article>
      </div>
     </template>
    </n-card>
   </div>
  </n-tab-pane>
  <n-tab-pane name="resources" tab="Android 增量资源" lazy>
   <AndroidUpdate :token="token" @updated="entry=>emit('updated',{kind:'android-resource',entry})"/>
  </n-tab-pane>
 </n-tabs>

 <publisher-dialog :model-value="Boolean(pendingPublish)" title="确认发布安装包" width="min(460px, 94vw)" @close="pendingPublish=null">
  <template v-if="pendingPublish">
   <p class="dialog-file">{{pendingPublish.file.name}}</p>
   <p class="metadata">{{platforms[pendingPublish.platform].name}} · {{pendingPublish.version}} · {{readableBytes(pendingPublish.file.size)}}</p>
   <p>{{pendingPublish.direct?'直传储存桶':'经发布服务器上传'}}。校验成功后更新下载入口。</p>
  </template>
  <template #footer>
   <n-button @click="pendingPublish=null">取消</n-button>
   <n-button type="primary" @click="publish">确认上传</n-button>
  </template>
 </publisher-dialog>

 <publisher-dialog :model-value="Boolean(pendingSwitch)" title="切换当前安装包" width="min(460px, 94vw)" @close="pendingSwitch=null">
  <template v-if="pendingSwitch">
   <p class="dialog-file">{{pendingSwitch.name}}</p>
   <p>{{platforms[pendingSwitch.platform]?.name}} 的下载入口会切换到 {{pendingSwitch.version}}。</p>
  </template>
  <template #footer>
   <n-button @click="pendingSwitch=null">取消</n-button>
   <n-button type="primary" @click="switchRelease">确认切换</n-button>
  </template>
 </publisher-dialog>
</template>

<style scoped>
.release-tabs{min-width:0}
.release-stack,.live-list{display:grid;gap:14px}
.release-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:14px;align-items:start}
.release-card{min-width:0;--n-card-border-radius:12px;--n-card-padding:18px}
.card-heading h2{margin:0;font-size:17px}
.card-heading p{margin:6px 0 0;color:var(--n-text-color-secondary);font-size:13px;line-height:1.5}
.with-action,.form-footer,.live-heading{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap}
.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.form-grid :deep(.n-select),:deep(.n-upload),:deep(.n-upload-dragger){width:100%}
:deep(.n-upload){display:block;min-width:0}
:deep(.n-upload-dragger){padding:22px 12px;background:var(--n-fill-color-lighter)}
.drop-label{margin:0;color:var(--n-text-color-primary);font-weight:600;line-height:1.5}
.form-footer{justify-content:flex-end;color:var(--n-text-color-secondary);font-size:13px}
.upload-progress{margin-top:14px;display:grid;gap:6px;font-size:13px}
.live-package{min-width:0;border:1px solid var(--n-border-color-lighter);border-radius:8px;padding:12px;background:var(--n-fill-color-lighter)}
.live-package p,.dialog-file{margin:8px 0;overflow-wrap:anywhere}
.live-package .n-button{margin-top:6px}
.metadata{font-size:13px;color:var(--n-text-color-secondary)}
.checksum{margin:6px 0;color:var(--n-text-color-secondary);font-size:12px}
.checksum summary{cursor:pointer;width:max-content}
.checksum code{display:block;margin-top:4px;overflow-wrap:anywhere}
.history-mobile{display:none}
@media(max-width:960px){
 .release-grid{grid-template-columns:1fr}
 .live-list{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(max-width:680px){
 .release-card{--n-card-padding:13px}
 .history-table{display:none}
 .history-mobile{display:grid;gap:8px}
}
@media(max-width:420px){
 .form-grid,.live-list{grid-template-columns:1fr;gap:8px}
 .form-grid :deep(.n-form-item){margin-bottom:10px}
 .release-tabs :deep(.n-tabs__item){padding-inline:10px}
}
</style>
