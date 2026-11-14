<script setup>
import {computed,ref} from 'vue';
import AndroidUpdate from './AndroidUpdate.vue';
import {ElAlert,ElButton,ElDialog,ElInput,ElOption,ElProgress,ElSelect,ElTable,ElTableColumn} from 'element-plus';

const props=defineProps({token:{type:String,required:true}});
const base=import.meta.env.BASE_URL;
const platform=ref('android'),version=ref(''),file=ref(null),busy=ref(false),progress=ref(0);
const confirm=ref(false),history=ref([]),selection=ref(null);
const releases=ref({}),message=ref(''),failed=ref(false);
const expectedExtension=computed(()=>platform.value==='android'?'.apk':'.zip');
async function load(){
 try{
  const response=await fetch(base+'../packages.json',{cache:'no-store'});
  if(!response.ok)throw Error('无法读取安装包目录');
  releases.value=await response.json();
 }catch(error){message.value=error.message;failed.value=true}
}
async function loadHistory(){
 if(!props.token.trim()){failed.value=true;message.value='请输入发布令牌';return}
 try{
  const response=await fetch(base+'api/packages',{headers:{Authorization:'Bearer '+props.token.trim()}});
  const data=await response.json();
  if(!response.ok)throw Error(data.error);
  history.value=data.releases;
 }catch(error){failed.value=true;message.value=error.message}
}
async function selectRelease(){
 const row=selection.value;
 selection.value=null;
 if(!row||busy.value)return;
 busy.value=true;
 try{
  const response=await fetch(base+'api/packages/select',{
   method:'POST',headers:{Authorization:'Bearer '+props.token.trim(),'Content-Type':'application/json'},
   body:JSON.stringify({platform:row.platform,path:row.path,expected:releases.value[row.platform]?.path??null}),
  });
  const data=await response.json();
  if(!response.ok)throw Error(data.error);
  releases.value={...releases.value,[row.platform]:data};
  failed.value=false;message.value='已切换至 '+data.name;
  await loadHistory();
 }catch(error){failed.value=true;message.value=error.message;await load()}
 finally{busy.value=false}
}
function selectFile(event){file.value=event.target.files[0]??null}
async function publish(){
 if(busy.value)return;
 message.value='';failed.value=false;
 if(!props.token.trim()||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(version.value)||!file.value?.name.toLowerCase().endsWith(expectedExtension.value)){
  failed.value=true;message.value='请输入发布令牌和有效版本号，并选择对应平台的文件。';return;
 }
 if(file.value.size>600*1024*1024){failed.value=true;message.value='安装包超过 600 MiB';return}
 busy.value=true;progress.value=0;
 try{
  const query=new URLSearchParams({platform:platform.value,version:version.value});
  const entry=await new Promise((resolve,reject)=>{
   const request=new XMLHttpRequest();
   request.open('POST',base+'api/packages?'+query);
   request.setRequestHeader('Authorization','Bearer '+props.token.trim());
   request.responseType='json';
   request.timeout=30*60*1000;
   request.upload.onprogress=event=>{if(event.lengthComputable)progress.value=Math.floor(event.loaded*100/event.total)};
   request.onload=()=>request.status===201?resolve(request.response):reject(Error(request.response?.error??'上传失败（HTTP '+request.status+'）'));
   request.onerror=()=>reject(Error('上传连接中断'));
   request.ontimeout=()=>reject(Error('上传超时'));
   request.send(file.value);
  });
  releases.value={...releases.value,[entry.platform]:entry};
  message.value='已发布 '+entry.name;
  await loadHistory();
 }catch(error){failed.value=true;message.value=error.message}
 finally{busy.value=false}
}
void load();
</script>

<template>
 <div class="actions">
  <el-select v-model="platform" aria-label="平台" style="width:180px" :disabled="busy">
   <el-option value="android" label="Android APK"/>
   <el-option value="windows" label="Windows 便携 ZIP"/>
  </el-select>
  <el-input v-model.trim="version" placeholder="版本号，例如 v2.1.0" aria-label="安装包版本" style="width:225px" :disabled="busy"/>
  <input type="file" :accept="expectedExtension" aria-label="安装包文件" :disabled="busy" @change="selectFile">
  <el-button type="primary" :loading="busy" @click="confirm=true">上传并发布</el-button>
 </div>
 <el-progress v-if="busy" :percentage="progress"/>
 <el-alert v-if="message" :title="message" :type="failed?'error':'success'" :closable="false"/>
 <el-table :data="Object.values(releases)" empty-text="暂无已发布安装包">
  <el-table-column prop="name" label="当前安装包" min-width="250"/>
  <el-table-column prop="version" label="版本" width="100"/>
  <el-table-column label="下载" width="100"><template #default="{row}"><a :href="row.path">下载</a></template></el-table-column>
  <el-table-column prop="sha256" label="SHA-256" min-width="200" show-overflow-tooltip/>
 </el-table>
 <el-button :disabled="busy" @click="loadHistory">读取安装包历史</el-button>
 <el-table v-if="history.length" :data="history">
  <el-table-column prop="name" label="已上传安装包" min-width="250"/>
  <el-table-column label="操作" width="150"><template #default="{row}"><span v-if="row.current">正在发布</span><el-button v-else link type="warning" :disabled="busy" @click="selection=row">设为当前版本</el-button></template></el-table-column>
 </el-table>
 <el-dialog v-model="confirm" title="发布安装包" width="min(440px,94vw)">
  <p>{{file?.name || '尚未选择文件'}} · {{version || '尚未填写版本'}}</p>
  <p>上传成功后，该平台的下载入口将切换到此版本。</p>
  <template #footer><el-button @click="confirm=false">取消</el-button><el-button type="primary" @click="confirm=false;publish()">确认上传</el-button></template>
 </el-dialog>
 <el-dialog :model-value="Boolean(selection)" title="切换当前安装包" width="min(440px,94vw)" @close="selection=null">
  <p>{{selection?.name}}</p>
  <template #footer><el-button @click="selection=null">取消</el-button><el-button type="warning" @click="selectRelease">确认切换</el-button></template>
 </el-dialog>
 <AndroidUpdate :token="token"/>
</template>
