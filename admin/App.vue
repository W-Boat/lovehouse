<script setup>
import Assets from './Assets.vue';
import Packages from './Packages.vue';
import History from './History.vue';
import ScenePreview from './ScenePreview.vue';
import InteractionBehavior from './InteractionBehavior.vue';
import MusicForm from './MusicForm.vue';
import MediaForm from './MediaForm.vue';
import { computed, ref, watch, onBeforeUnmount, onMounted } from 'vue';
import { ElAlert, ElButton, ElInput, ElInputNumber, ElMenu, ElMenuItem, ElMenuItemGroup, ElTag, ElDialog } from 'element-plus';

const sections = [
 ['texts','文案','按稳定 ID 修改对白、赠言和界面文字。',{}],
 ['scenes','场景','设置背景、行走区域和双向入口。',[]],
 ['interactions','互动','配置场景点位、反馈和小游戏入口。',[]],
 ['bundled','包内配置','查看随客户端发布的完整配置和点位。',null],
 ['gifts','礼物配置','按礼物 ID 修改内容、HTTPS 配图、坐标 x/y 和落脚点 point。',{}],
 ['announcement','游戏私告','启用后在玩家进入小屋时显示。',{enabled:false,title:'',body:''}],
 ['giftGames','礼物小游戏','以礼物 ID 绑定独立游戏的 HTTPS 地址。',{}],
 ['musicRoom','唱片房','设置在线歌单或自选曲目。',null],
 ['media','替换素材','设置礼物图片、回忆照片和演唱会音源。',{}],
 ['portals','传送门','配置桃源乡旁的两个网页入口。',[]],
 ['history','发布历史','查看历史、导入旧稿或回滚线上配置。',null],
 ['packages','安装包','发布已构建的客户端，并提供下载入口。',null],
 ['assets','素材库','上传图片、音频和歌词，复制链接到发布配置。',null],
 ['all','完整配置','适用于批量修改和 Agent 生成的 JSON。',{}],
];

const sectionGroups=[
 ['内容',['texts','scenes','interactions','gifts','giftGames','announcement','bundled','musicRoom','media','portals','all']],
 ['发布与资源',['history','packages','assets']],
];
const labels=Object.fromEntries(sections.map(([id,label])=>[id,label]));
const base=import.meta.env.BASE_URL;

const structuredFields={
 scenes:[['id','场景 ID'],['parent','父场景 ID'],['name','名称'],['caption','简介'],['background','背景 HTTPS 地址'],['entrance','父场景入口',2],['spawn','到达点',2],['exit','返回点',2],['floor','行走范围（左上 / 右下）',4]],
 interactions:[['id','互动 ID'],['zone','场景 ID'],['name','名称'],['action','按钮文案'],['response','反馈'],['x','图标 X',1],['y','图标 Y',1],['point','落脚点',2],['game','内置小游戏 ID'],['gameUrl','独立小游戏 HTTPS 地址'],['url','网页 HTTPS 地址']],
 portals:[['label','名称'],['url','网页 HTTPS 地址']],
};
const formSections=['texts','giftGames','musicRoom','media',...Object.keys(structuredFields)];

  const selected=ref('texts'), token=ref(''), draft=ref({}), revision=ref('');
  const bundled=ref({}),baseline=ref({}),summary=ref([]),savedAt=ref(''),draftAvailable=ref(false);
  const storageKey='lovehouse-publisher-draft:'+import.meta.env.BASE_URL;
  const publicRevision=ref(''), publicPackages=ref({}), authState=ref('idle');
  const draftRevision=ref(null);
  const conflict=computed(()=>loaded.value&&draftRevision.value!==revision.value);
  let authTimer,authController,hasEdited=false,refreshingEditor=false;
  const loaded=ref(false), form=ref(false), entries=ref([]), search=ref('');
  const records=ref([]),objectValue=ref({});
  const specialForm=computed(()=>form.value&&['musicRoom','media'].includes(selected.value));
  const fields=computed(()=>selected.value==='interactions'?structuredFields.interactions.filter(([key])=>!['game','gameUrl','url'].includes(key)):structuredFields[selected.value]);
  const visibleEntries=computed(()=>entries.value.filter(row=>!search.value||row.key.includes(search.value)||row.value.includes(search.value)));
  const replaceConfirm=ref(false);
  const text=ref('{}'), status=ref(''), success=ref(false), busy=ref(false), confirm=ref(false);
  const section=computed(()=>sections.find(([id])=>id===selected.value));
  function collect(){
   if(['assets','history','packages','bundled'].includes(selected.value))return;
   let value;
   if(specialForm.value)value=objectValue.value;
   else if(form.value&&fields.value){
    value=records.value.map(record=>{
     const result={...record};
     if(selected.value==='scenes')result.floor=[record.floor.slice(0,2),record.floor.slice(2)];
     if(selected.value==='interactions')for(const key of ['game','url','gameUrl'])if(!result[key])delete result[key];
     return result;
    });
   }else if(form.value){
    const pairs=entries.value.map(({key,value})=>[key.trim(),value]);
    if(pairs.some(([key])=>!key)||new Set(pairs.map(([key])=>key)).size!==pairs.length)throw Error('请填写唯一的稳定 ID');
    value=Object.fromEntries(selected.value==='texts'?pairs.filter(([key,value])=>bundled.value.texts?.[key]!==value):pairs);
   }else value=JSON.parse(text.value);
   if(selected.value==='all'){
    if(!value||typeof value!=='object'||Array.isArray(value))throw Error('完整配置必须是 JSON 对象');
    draft.value=value;
   }else if(value===null){
    delete draft.value[selected.value];
   }else draft.value[selected.value]=value;
  }
  function choose(id){
   try{
    collect();
    const leavingPackages=selected.value==='packages'&&id!=='packages';
    selected.value=id;if(token.value.trim())void readBundled();form.value=formSections.includes(id);search.value='';refreshText();status.value='';
    if(leavingPackages)void refreshPublic();
   }
   catch(error){report(error.message)}
  }
  function refreshText(){
   refreshingEditor=true;
   try{refreshEditorFields()}finally{refreshingEditor=false}
  }
  function refreshEditorFields(){
   const value=selected.value==='all'?draft.value:selected.value==='texts'?{...bundled.value.texts,...draft.value.texts}:draft.value[selected.value]??section.value[3];
   text.value=JSON.stringify(value,null,2);
   if(specialForm.value)objectValue.value=JSON.parse(JSON.stringify(value??{}));
   else if(form.value&&fields.value){
    if(!Array.isArray(value)){form.value=false;return}
    records.value=value.map(record=>({
     ...Object.fromEntries(fields.value.map(([key,,size])=>[key,size>1?Array(size).fill(undefined):size?undefined:''])),
     ...record,
     ...Object.fromEntries(fields.value.filter(([,,size])=>size>1).map(([key,,size])=>{
      const values=Array.isArray(record?.[key])?record[key].flat():[];
      return [key,Array.from({length:size},(_,i)=>values[i])];
     })),
    }));
   }else if(form.value)entries.value=Object.entries(value).map(([key,value])=>({key,value:String(value)}));
  }
  function addRecord(){
   records.value.push(Object.fromEntries(fields.value.map(([key,,size])=>[
    key,size>1?Array(size).fill(undefined):size?undefined:key==='id'?'cloud-':'',
   ])));
  }
  function toggleEditor(){
   try{collect();form.value=!form.value;refreshText()}
   catch(error){report(error.message)}
  }
  form.value=true;
  function report(message,ok=false){status.value=message;success.value=ok}
  let catalogToken='';
  async function readBundled(){
   const current=token.value.trim();if(!current||catalogToken===current)return;
   catalogToken=current;
   try{
    const response=await fetch(import.meta.env.BASE_URL+'api/bundled',{headers:{Authorization:'Bearer '+current}});
    if(!response.ok)throw Error('读取包内目录失败');
    const data=await response.json();
    if(current===token.value.trim()){
     if(selected.value==='texts')collect();
     bundled.value=data.baseline;refreshText();
    }
   }catch{if(catalogToken===current)catalogToken=''}
  }
  async function request(action){
   busy.value=true;
   try{
    if(!token.value.trim())throw Error('请输入发布令牌');
    if(action==='publish'&&(!loaded.value||conflict.value))throw Error('请先确认草稿基于当前版本');
    if(action!=='snapshot')collect();
    const response=await fetch(import.meta.env.BASE_URL+'api/'+action,{
     method:action==='snapshot'?'GET':'POST',
     headers:{Authorization:'Bearer '+token.value.trim(),'Content-Type':'application/json',...(action==='publish'?{'If-Match':JSON.stringify(draftRevision.value)}:{})},
     body:action==='snapshot'?undefined:JSON.stringify(draft.value),
    });
    const data=await response.json();
    if(!response.ok){
     if(response.status===412){await connect();throw Error('线上版本已经变化，请核对后确认草稿基准。')}
     throw Error(data.error||'请求失败');
    }
    if(action==='snapshot'){
     await readBundled();
     const {schema,revision:live,...config}=data;
     draft.value=config;baseline.value=structuredClone(config);revision.value=live??'';publicRevision.value=revision.value;draftRevision.value=revision.value;loaded.value=true;draftAvailable.value=false;refreshText();saveLocal();
    }
    if(action==='publish'){revision.value=data.revision;publicRevision.value=revision.value;draftRevision.value=revision.value;baseline.value=JSON.parse(JSON.stringify(draft.value))}
    report(action==='snapshot'?'已读取发布版本':action==='check'?'校验通过 · '+data.revision.slice(0,12):'发布成功',true);
   }catch(error){report(error.message)}
   finally{busy.value=false}
  }
  function exportDraft(){
   try{
    collect();const url=URL.createObjectURL(new Blob([JSON.stringify(draft.value,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='lovehouse-content.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
   }catch(error){report(error.message)}
  }
  async function importDraft(event){
   const file=event.target.files[0];event.target.value='';
   if(!file)return;
   try{
    if(file.size>1_000_000)throw Error('配置文件超过 1 MB');
    const value=JSON.parse(await file.text());
    if(!value||typeof value!=='object'||Array.isArray(value))throw Error('请选择 JSON 对象');
    saveLocal(true);
    const {schema,revision:importedRevision,...config}=value;draft.value=config;hasEdited=true;draftRevision.value=typeof importedRevision==='string'?importedRevision:null;refreshText();saveLocal();report('草稿已导入',true);
   }catch(error){report(error.message)}
  }
  function saveLocal(backup=false){
   try{collect()}catch{}
   try{
    const data=JSON.stringify({draft:draft.value,selected:selected.value,text:text.value,entries:entries.value,records:records.value,objectValue:objectValue.value,form:form.value,draftRevision:draftRevision.value});
    localStorage.setItem(storageKey,data);
    if(backup===true)localStorage.setItem(storageKey+':previous',data);
    savedAt.value=new Date().toLocaleTimeString();
   }catch{report('本机草稿保存失败，请导出 JSON 备份。')}
  }
  let saveTimer;
  function flushDraft(){
   if(saveTimer===undefined)return;
   clearTimeout(saveTimer);saveTimer=undefined;
   saveLocal();
  }
  watch([text,entries,records,objectValue],()=>{
   if(refreshingEditor)return;
   hasEdited=true;clearTimeout(saveTimer);saveTimer=setTimeout(flushDraft,800);
  },{deep:true,flush:'sync'});
  onMounted(()=>window.addEventListener('pagehide',flushDraft));
  onBeforeUnmount(()=>{
   window.removeEventListener('pagehide',flushDraft);
   flushDraft();clearTimeout(authTimer);authController?.abort();
  });
  try{draftAvailable.value=Boolean(localStorage.getItem(storageKey))}catch{}
  function restoreLocal(previous=false){
   try{
    const value=JSON.parse(localStorage.getItem(previous===true?storageKey+':previous':storageKey));
    if(!value?.draft||typeof value.draft!=='object'||Array.isArray(value.draft))throw Error('草稿格式无效');
    draft.value=value.draft;draftRevision.value=typeof value.draftRevision==='string'?value.draftRevision:null;selected.value=sections.some(([id])=>id===value.selected)?value.selected:'all';
    form.value=Boolean(value.form)&&formSections.includes(selected.value);
    refreshText();text.value=value.text??text.value;entries.value=value.entries??entries.value;records.value=value.records??records.value;objectValue.value=value.objectValue??objectValue.value;
    hasEdited=true;draftAvailable.value=false;report(loaded.value?'本机草稿已恢复。':'本机草稿已恢复。输入发布令牌后会读取当前线上版本。',true);
   }catch(e){report(e.message)}
  }
  async function refreshPublic(){
   const read=async(path)=>{
    const response=await fetch(base+'../'+path,{cache:'no-store'});
    if(!response.ok)throw Error('无法读取发布状态');
    return response.json();
   };
   const [content,packages]=await Promise.allSettled([read('content.json'),read('packages.json')]);
   if(content.status==='fulfilled')publicRevision.value=content.value.revision??'';
   if(packages.status==='fulfilled')publicPackages.value=packages.value;
  }
  onMounted(refreshPublic);
  async function connect(){
   authController?.abort();
   const controller=new AbortController();
   authController=controller;
   loaded.value=false;authState.value='checking';
   try{
    const response=await fetch(base+'api/snapshot',{
     headers:{Authorization:'Bearer '+token.value.trim()},signal:controller.signal,cache:'no-store',
    });
    const data=await response.json();
    if(!response.ok)throw Error(data.error||'认证失败');
    if(controller.signal.aborted)return;
    const {schema,revision:current,...config}=data;
    revision.value=current??'';publicRevision.value=revision.value;baseline.value=config;
    if(!hasEdited&&!draftAvailable.value){
     draft.value=structuredClone(config);draftRevision.value=revision.value;refreshText();
    }
    loaded.value=true;authState.value='ready';
    report('已连接发布服务器。',true);
   }catch(error){
    if(controller.signal.aborted)return;
    authState.value='error';report(error.message);
   }
  }
  watch(token,()=>{
   authController?.abort();clearTimeout(authTimer);loaded.value=false;status.value='';
   authState.value=token.value.trim()?'checking':'idle';
   if(token.value.trim())authTimer=setTimeout(connect,450);
  },{flush:'sync'});
  function rebaseDraft(){
   try{
    collect();saveLocal(true);draftRevision.value=revision.value;saveLocal();
    report('已更新草稿的发布基准，请核对差异后再发布。',true);
   }catch(error){report(error.message)}
  }
  function review(){
   try{collect();summary.value=[...new Set([...Object.keys(baseline.value),...Object.keys(draft.value)])].filter(key=>JSON.stringify(baseline.value[key])!==JSON.stringify(draft.value[key]));confirm.value=true}
   catch(e){report(e.message)}
  }
  function importHistory(snapshot){
   saveLocal(true);const {schema,revision:old,...config}=snapshot;draft.value=config;hasEdited=true;draftRevision.value=old??null;selected.value='all';form.value=false;refreshText();saveLocal();report('历史版本已载入草稿，发布前请校验。',true);
  }
</script>

<template>
<header class="top">
 <div class="identity"><span class="mark" aria-hidden="true">小</span><div><strong>生日小屋</strong><small>内容发布后台</small></div></div>
 <div class="top-actions">
  <el-tag effect="light" :type="authState==='ready'?'success':authState==='error'?'danger':'info'">{{{idle:'访客',checking:'正在验证',ready:'已认证',error:'认证失败'}[authState]}}</el-tag>
  <el-input v-model="token" type="password" show-password autocomplete="off" placeholder="输入发布令牌" aria-label="发布令牌"/>
 </div>
</header>
<main class="workspace">
 <aside aria-label="后台导航">
  <el-menu :default-active="selected" @select="choose">
   <el-menu-item-group v-for="[label,ids] in sectionGroups" :key="label" :title="label">
    <el-menu-item v-for="id in ids" :key="id" :index="id">{{labels[id]}}</el-menu-item>
   </el-menu-item-group>
  </el-menu>
 </aside>
 <div class="workspace-main">
  <div class="release-summary" aria-label="线上版本">
   <div><span>内容版本</span><strong>{{publicRevision.slice(0,12)||'—'}}</strong></div>
   <div><span>Android 安装包</span><strong>{{publicPackages.android?.version||'—'}}</strong></div>
   <div><span>Windows 便携包</span><strong>{{publicPackages.windows?.version||'—'}}</strong></div>
  </div>
  <section class="editor">
   <el-alert v-if="conflict" title="草稿与线上版本的基准不同，请核对后确认发布基准。" type="warning" :closable="false"/>
   <el-alert v-if="status" :title="status" :type="success?'success':'error'" :closable="false" show-icon />
   <el-alert v-if="draftAvailable" title="发现本机未发布草稿" type="info" :closable="false"><el-button @click="restoreLocal">恢复草稿</el-button></el-alert>
   <small v-if="savedAt" class="draft-status">本机草稿已保存 {{savedAt}}</small>
   <div class="heading"><div><h1>{{section[1]}}</h1><p>{{section[2]}}</p></div><div v-if="!['assets','history','packages'].includes(selected)" class="actions"><label class="import">导入 JSON<input type="file" accept=".json,application/json" @change="importDraft"></label><el-button @click="exportDraft">导出草稿</el-button><el-button @click="restoreLocal(true)">恢复覆盖前草稿</el-button></div></div>
   <template v-if="selected==='packages'">
    <Packages :token="token" @updated="refreshPublic"/>
   </template>
   <template v-else-if="selected==='assets'">
    <Assets :token="token"/>
   </template>
   <template v-else-if="selected==='history'">
    <History :token="token" :revision="revision" @import="importHistory" @restore="connect"/>
   </template>
   <template v-else>
   <div v-if="formSections.includes(selected)" class="actions"><el-button @click="toggleEditor">{{form?'编辑 JSON':'表单编辑'}}</el-button><el-button v-if="form && fields" @click="addRecord">新增条目</el-button><template v-else-if="form && !specialForm"><el-input v-model="search" clearable placeholder="搜索 ID 或内容" aria-label="搜索条目"/><el-button @click="search=''; entries.push({key:'',value:''})">新增条目</el-button></template></div>
   <MusicForm v-if="specialForm && selected==='musicRoom'" v-model="objectValue"/>
   <MediaForm v-else-if="specialForm && selected==='media'" v-model="objectValue"/>
   <div v-else-if="form && fields" class="record-list">
    <details v-for="(record,index) in records" :key="record" class="record">
     <summary>{{ record.name || record.label || record.id || '新条目' }}</summary>
     <ScenePreview v-if="selected==='scenes'" :scene="record" @update:scene="value=>records[index]=value"/>
     <InteractionBehavior v-if="selected==='interactions'" :model-value="record" @update:model-value="value=>records[index]=value"/>
     <div class="record-fields">
      <div v-for="[key,label,size] in fields" :key="key" class="field">
       <span>{{label}}</span>
       <el-input v-if="!size" v-model="record[key]" :aria-label="label"/>
       <el-input-number v-else-if="size===1" v-model="record[key]" :aria-label="label" :controls="false" :min="0" :max="key==='x'?640:426"/>
       <div v-else class="coordinates">
        <el-input-number v-for="n in size" :key="n" v-model="record[key][n-1]" :aria-label="label+' '+n" :controls="false" :min="0" :max="n%2?640:426"/>
       </div>
      </div>
      <el-button text type="danger" @click="records.splice(index,1)">移除条目</el-button>
     </div>
    </details>
    <p v-if="!records.length" class="empty">暂无条目，可新增或导入草稿。</p>
   </div>
   <div v-else-if="form" class="entry-list">
    <div v-for="row in visibleEntries" :key="entries.indexOf(row)" class="entry">
     <el-input v-model="row.key" aria-label="稳定 ID" placeholder="稳定 ID"/>
     <el-input v-model="row.value" :type="selected==='texts'?'textarea':'text'" aria-label="内容" :placeholder="selected==='texts'?'文字':'HTTPS 地址'"/>
     <el-button text type="danger" @click="entries.splice(entries.indexOf(row),1)">移除</el-button>
    </div>
    <p v-if="!visibleEntries.length" class="empty">{{search?'没有匹配条目':'暂无条目，可新增或导入草稿。'}}</p>
   </div>
   <el-input v-else-if="selected==='bundled'" :model-value="JSON.stringify(bundled,null,2)" readonly type="textarea" :rows="20"/>
   <el-input v-else v-model="text" type="textarea" :rows="17" resize="vertical" aria-label="配置 JSON" class="code"/>
   <div class="publish"><div class="actions">
    <el-button :disabled="busy || !loaded" @click="replaceConfirm=true">载入线上配置</el-button>
    <el-button v-if="conflict" @click="rebaseDraft">确认以当前版本为基准</el-button>
    <el-button :disabled="busy || !loaded" @click="request('check')">校验草稿</el-button>
    <el-button type="primary" :disabled="busy || !loaded || conflict" @click="review">发布</el-button>
   </div></div>
   </template>
  </section>
 </div>
</main>
 <el-dialog v-model="replaceConfirm" title="载入线上配置？" width="min(440px,94vw)"><p>当前草稿会先保存到本机，然后载入线上内容。</p><template #footer><el-button @click="replaceConfirm=false">取消</el-button><el-button type="primary" @click="saveLocal(true); replaceConfirm=false; request('snapshot')">载入</el-button></template></el-dialog>
 <el-dialog v-model="confirm" title="发布当前草稿？" width="min(440px, 94vw)"><p>玩家下次启动时会同步此配置。</p><p>变更分区 {{summary.map(id=>labels[id]||id).join('、') || '无变更'}}</p><template #footer><el-button @click="confirm=false">取消</el-button><el-button type="primary" @click="confirm=false; request('publish')">确认发布</el-button></template></el-dialog>
 </template>
