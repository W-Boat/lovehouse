<script setup>
import {computed, ref} from 'vue';
import {
 ElAlert, ElButton, ElCard, ElDialog, ElEmpty, ElForm, ElFormItem, ElInput,
 ElOption, ElProgress, ElSelect, ElTabPane, ElTable, ElTableColumn, ElTabs, ElTag, ElUpload,
} from 'element-plus';
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
const progress=ref(0);
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

function checkFile(upload){
 const candidate=upload.raw;
 if(!candidate)return;
 if(!candidate.name.toLowerCase().endsWith(selectedPlatform.value.extension)){
  report('error','请选择 '+selectedPlatform.value.format+' 文件。');
 }else if(candidate.size>packageLimit){
  report('error','安装包超过 600 MiB。');
 }else{
  notice.value=null;
  return;
 }
 files.value=[];
}

function stagePublish(){
 notice.value=null;
 if(!props.token.trim()){
  report('error','请先填写发布令牌。');
 }else if(!versionPattern.test(version.value)){
  report('error','版本号应为 1 至 64 个字符，以字母或数字开头，可包含点、下划线和连字符。');
 }else if(!file.value){
  report('error','请选择要发布的安装包。');
 }else{
  pendingPublish.value={platform:platform.value,version:version.value,file:file.value};
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
  const query=new URLSearchParams({platform:draft.platform,version:draft.version});
  const entry=await new Promise((resolve,reject)=>{
   const request=new XMLHttpRequest();
   request.open('POST',base+'api/packages?'+query);
   request.setRequestHeader('Authorization','Bearer '+token);
   request.responseType='json';
   request.timeout=30*60*1000;
   request.upload.onprogress=event=>{
    if(event.lengthComputable)progress.value=Math.min(99,Math.floor(event.loaded*100/event.total));
   };
   request.onload=()=>request.status===201&&request.response
    ?resolve(request.response)
    :reject(Error(request.response?.error??'上传失败（HTTP '+request.status+'）'));
   request.onerror=()=>reject(Error('上传连接中断'));
   request.ontimeout=()=>reject(Error('上传超时'));
   request.send(draft.file);
  });
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
</script>

<template>
 <el-tabs v-model="tab" class="release-tabs">
  <el-tab-pane name="packages" label="客户端安装包">
   <div class="release-stack">
    <el-alert v-if="notice" :title="notice.text" :type="notice.type" show-icon :closable="false"/>
    <div class="release-grid">
     <el-card shadow="never" class="release-card">
      <template #header>
       <div class="card-heading">
        <h2>发布安装包</h2>
        <p>上传 Actions 构建的客户端，更新对应平台的下载入口。</p>
       </div>
      </template>
      <el-form label-position="top" :disabled="busy" @submit.prevent="stagePublish">
       <div class="form-grid">
        <el-form-item label="平台">
         <el-select v-model="platform" aria-label="发布平台" @change="choosePlatform">
          <el-option v-for="(entry,key) in platforms" :key="key" :value="key" :label="entry.name+' · '+entry.format"/>
         </el-select>
        </el-form-item>
        <el-form-item label="版本号">
         <el-input v-model.trim="version" aria-label="安装包版本号" placeholder="例如 v2.1.0" maxlength="64" autocomplete="off"/>
        </el-form-item>
       </div>
       <el-form-item label="安装文件">
        <el-upload
         v-model:file-list="files" drag :auto-upload="false" :limit="1"
         :accept="selectedPlatform.extension" :disabled="busy" :on-change="checkFile"
         :on-exceed="()=>report('info','请先移除已选安装包，再选择新文件。')"
        >
         <p class="drop-label">点击选择或拖放安装包</p>
         <small>{{selectedPlatform.format}} · 最大 600 MiB</small>
        </el-upload>
       </el-form-item>
       <div class="form-footer">
        <span v-if="file">{{readableBytes(file.size)}}</span>
        <el-button type="primary" native-type="submit" :loading="publishing" :disabled="busy">审核并发布</el-button>
       </div>
       <div v-if="publishing" class="upload-progress" role="status">
        <span>{{progress===99?'正在校验安装包':'正在上传安装包'}}</span>
        <el-progress :percentage="progress"/>
       </div>
      </el-form>
     </el-card>
     <el-card shadow="never" class="release-card">
      <template #header>
       <div class="card-heading with-action">
        <div><h2>当前版本</h2><p>客户端下载入口</p></div>
        <el-button text :loading="catalogBusy" :disabled="busy" @click="readCatalog">刷新</el-button>
       </div>
      </template>
      <el-alert v-if="catalogError" :title="catalogError" type="error" show-icon :closable="false"/>
      <div class="live-list">
       <article v-for="(entry,key) in platforms" :key="key" class="live-package">
        <div class="live-heading">
         <strong>{{entry.name}}</strong>
         <el-tag v-if="catalog[key]" type="success" effect="light">{{catalog[key].version}}</el-tag>
         <el-tag v-else type="info" effect="plain">{{catalogBusy?'读取中':'未发布'}}</el-tag>
        </div>
        <template v-if="catalog[key]">
         <p class="file-name" :title="catalog[key].name">{{catalog[key].name}}</p>
         <p class="metadata">{{readableBytes(catalog[key].bytes)}} · {{readableDate(catalog[key].publishedAt)}}</p>
         <details v-if="catalog[key].sha256" class="checksum">
          <summary>SHA-256</summary>
          <code>{{catalog[key].sha256}}</code>
         </details>
         <el-button tag="a" :href="catalog[key].path" size="small" plain>下载安装包</el-button>
        </template>
        <p v-else class="metadata">{{entry.format}}</p>
       </article>
      </div>
     </el-card>
    </div>
    <el-card shadow="never" class="release-card">
     <template #header>
      <div class="card-heading with-action">
       <div><h2>版本历史</h2><p>需要时可将下载入口切回已上传版本。</p></div>
       <el-button plain :loading="historyBusy" :disabled="busy" @click="readHistory">{{historyLoaded?'刷新历史':'读取历史'}}</el-button>
      </div>
     </template>
     <el-alert v-if="historyError" :title="historyError" type="error" show-icon :closable="false"/>
     <el-empty v-if="!history.length && !historyBusy && !historyError" :image-size="56" :description="historyLoaded?'暂无安装包记录':'填写发布令牌后读取版本历史'"/>
     <template v-if="history.length">
      <el-table :data="history" row-key="path" class="history-table" aria-label="安装包版本历史">
       <el-table-column label="安装包" min-width="200">
        <template #default="{row}">
         <strong>{{row.version}}</strong>
         <div class="metadata">{{row.name}}</div>
        </template>
       </el-table-column>
       <el-table-column label="大小" width="110">
        <template #default="{row}">{{readableBytes(row.bytes)}}</template>
       </el-table-column>
       <el-table-column label="上传时间" min-width="140">
        <template #default="{row}">{{readableDate(row.publishedAt)}}</template>
       </el-table-column>
       <el-table-column label="状态与操作" width="130">
        <template #default="{row}">
         <el-tag v-if="row.current" type="success" effect="light">当前版本</el-tag>
         <el-button v-else link type="primary" :disabled="busy" @click="stageSwitch(row)">设为当前版本</el-button>
        </template>
       </el-table-column>
      </el-table>
      <div class="history-mobile">
       <article v-for="row in history" :key="row.path" class="live-package">
        <div class="live-heading">
         <strong>{{row.version}}</strong>
         <el-tag v-if="row.current" type="success" effect="light">当前版本</el-tag>
        </div>
        <p class="file-name">{{row.name}}</p>
        <p class="metadata">{{readableBytes(row.bytes)}} · {{readableDate(row.publishedAt)}}</p>
        <el-button v-if="!row.current" plain :disabled="busy" @click="stageSwitch(row)">设为当前版本</el-button>
       </article>
      </div>
     </template>
    </el-card>
   </div>
  </el-tab-pane>
  <el-tab-pane name="resources" label="Android 增量资源" lazy>
   <AndroidUpdate :token="token" @updated="entry=>emit('updated',{kind:'android-resource',entry})"/>
  </el-tab-pane>
 </el-tabs>

 <el-dialog :model-value="Boolean(pendingPublish)" title="确认发布安装包" width="min(460px, 94vw)" @close="pendingPublish=null">
  <template v-if="pendingPublish">
   <p class="dialog-file">{{pendingPublish.file.name}}</p>
   <p class="metadata">{{platforms[pendingPublish.platform].name}} · {{pendingPublish.version}} · {{readableBytes(pendingPublish.file.size)}}</p>
   <p>上传成功后，该平台的下载入口会切换到此版本。</p>
  </template>
  <template #footer>
   <el-button @click="pendingPublish=null">取消</el-button>
   <el-button type="primary" @click="publish">确认上传</el-button>
  </template>
 </el-dialog>

 <el-dialog :model-value="Boolean(pendingSwitch)" title="切换当前安装包" width="min(460px, 94vw)" @close="pendingSwitch=null">
  <template v-if="pendingSwitch">
   <p class="dialog-file">{{pendingSwitch.name}}</p>
   <p>{{platforms[pendingSwitch.platform]?.name}} 的下载入口会切换到 {{pendingSwitch.version}}。</p>
  </template>
  <template #footer>
   <el-button @click="pendingSwitch=null">取消</el-button>
   <el-button type="primary" @click="switchRelease">确认切换</el-button>
  </template>
 </el-dialog>
</template>

<style scoped>
.release-tabs{min-width:0}
.release-stack,.live-list{display:grid;gap:14px}
.release-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:14px;align-items:start}
.release-card{min-width:0;--el-card-border-radius:12px;--el-card-padding:18px}
.card-heading h2{margin:0;font-size:17px}
.card-heading p{margin:6px 0 0;color:var(--el-text-color-secondary);font-size:13px;line-height:1.5}
.with-action,.form-footer,.live-heading{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap}
.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.form-grid :deep(.el-select),:deep(.el-upload),:deep(.el-upload-dragger){width:100%}
:deep(.el-upload){display:block;min-width:0}
:deep(.el-upload-dragger){padding:22px 12px;background:var(--el-fill-color-lighter)}
.drop-label{margin:0;color:var(--el-text-color-primary);font-weight:600;line-height:1.5}
.form-footer{justify-content:flex-end;color:var(--el-text-color-secondary);font-size:13px}
.upload-progress{margin-top:14px;display:grid;gap:6px;font-size:13px}
.live-package{min-width:0;border:1px solid var(--el-border-color-lighter);border-radius:8px;padding:12px;background:var(--el-fill-color-lighter)}
.live-package p,.dialog-file{margin:8px 0;overflow-wrap:anywhere}
.live-package .el-button{margin-top:6px}
.metadata{font-size:13px;color:var(--el-text-color-secondary)}
.checksum{margin:6px 0;color:var(--el-text-color-secondary);font-size:12px}
.checksum summary{cursor:pointer;width:max-content}
.checksum code{display:block;margin-top:4px;overflow-wrap:anywhere}
.history-mobile{display:none}
@media(max-width:960px){
 .release-grid{grid-template-columns:1fr}
 .live-list{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(max-width:680px){
 .release-card{--el-card-padding:13px}
 .history-table{display:none}
 .history-mobile{display:grid;gap:8px}
}
@media(max-width:420px){
 .form-grid,.live-list{grid-template-columns:1fr;gap:8px}
 .form-grid :deep(.el-form-item){margin-bottom:10px}
 .release-tabs :deep(.el-tabs__item){padding-inline:10px}
}
</style>
