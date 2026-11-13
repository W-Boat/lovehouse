<script setup>
import {ref} from 'vue';
import {ElAlert,ElButton,ElDialog,ElInput,ElTable,ElTableColumn} from 'element-plus';
const props=defineProps({token:{type:String,required:true}});
const assets=ref([]),busy=ref(false),notice=ref(''),failed=ref(false),selected=ref(null);
async function call(method,path='',body,headers={}){
 if(!props.token.trim())throw Error('请输入发布令牌');
 const response=await fetch(import.meta.env.BASE_URL+'api/assets'+path,{method,body,headers:{Authorization:'Bearer '+props.token.trim(),...headers}});
 const data=await response.json();
 if(!response.ok)throw Error(data.error||'素材请求失败');
 return data;
}
async function run(action){
 if(busy.value)return;
 busy.value=true;notice.value='';failed.value=false;
 try{await action()}catch(error){notice.value=error.message;failed.value=true}
 finally{busy.value=false}
}
async function load(){assets.value=(await call('GET')).assets}
function upload(event){
 const file=event.target.files[0];event.target.value='';
 if(!file)return;
 return run(async()=>{
  const {asset}=await call('POST','',file,{'Content-Type':file.type||'application/octet-stream','X-Asset-Name':encodeURIComponent(file.name)});
  await load();
  notice.value='已上传 '+asset.name;
 });
}
function remove(){
 const asset=selected.value;selected.value=null;
 if(!asset)return;
 return run(async()=>{await call('DELETE','/'+encodeURIComponent(asset.id));await load();notice.value='已删除 '+asset.name});
}
const assetUrl=asset=>new URL(asset.path,location.origin).href;
async function copy(asset){
 try{await navigator.clipboard.writeText(assetUrl(asset));failed.value=false;notice.value='素材链接已复制'}
 catch{failed.value=true;notice.value='无法访问剪贴板，可从地址栏手动复制'}
}
</script>

<template>
 <div class="actions"><label class="import" :class="{disabled:busy}">上传素材<input type="file" :disabled="busy" accept="image/png,image/jpeg,image/webp,image/avif,.mp3,.wav,.ogg,.m4a,.lrc" @change="upload"></label><el-button :disabled="busy" @click="run(load)">刷新列表</el-button></div>
 <el-alert v-if="notice" :title="notice" :type="failed?'error':'success'" :closable="false" show-icon />
 <el-table :data="assets" empty-text="读取素材列表后即可查看已上传文件">
  <el-table-column label="素材" min-width="170"><template #default="{row}"><div class="asset-name"><img v-if="row.mime?.startsWith('image/')" :src="row.path" alt="" loading="lazy"><div><strong>{{row.name}}</strong><small>{{(row.bytes/1024).toFixed(1)}} KB</small></div></div></template></el-table-column>
  <el-table-column label="链接" min-width="200"><template #default="{row}"><el-input :model-value="assetUrl(row)" readonly aria-label="素材地址"/></template></el-table-column>
  <el-table-column label="操作" width="132"><template #default="{row}"><el-button link @click="copy(row)">复制</el-button><el-button link type="danger" :disabled="busy" @click="selected=row">删除</el-button></template></el-table-column>
 </el-table>
 <el-dialog :model-value="Boolean(selected)" title="删除此素材？" width="min(440px, 94vw)" @close="selected=null">
  <p>{{selected?.name}}</p><template #footer><el-button @click="selected=null">取消</el-button><el-button type="danger" @click="remove">确认删除</el-button></template>
 </el-dialog>
</template>
