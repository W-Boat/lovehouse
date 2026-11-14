<script setup>
import {configurationChanges} from "./configuration-changes.js";
import ResourceLink from "./ResourceLink.vue";
import IconButton from './IconButton.vue';
import PageLoading from './page-loading.js';
import checkIcon from '@iconify-icons/mdi/check-decagram-outline';
import publishIcon from '@iconify-icons/mdi/cloud-upload-outline';
import keyIcon from '@iconify-icons/mdi/key-outline';
import logoutIcon from '@iconify-icons/mdi/logout';
import refreshIcon from '@iconify-icons/mdi/refresh';
import {NInputNumber} from 'naive-ui';
import {PublisherAlert,PublisherDialog} from './publisher-components.js';
const StorageRules=defineAsyncComponent(()=>import('./StorageRules.vue'));
const OpeningRules=defineAsyncComponent(()=>import('./OpeningRules.vue'));
const Guide=defineAsyncComponent({loader:()=>import('./Guide.vue'),loadingComponent:PageLoading,delay:120});
import AdminLayout from './AdminLayout.vue';
import {NButton,NInput,NTag,NSwitch,NDataTable,NCard,NForm,NFormItem,NPagination,NTabs,NTabPane,NCollapse,NCollapseItem,NDropdown,NSpin} from 'naive-ui';
const Assets=defineAsyncComponent({loader:()=>import('./Assets.vue'),loadingComponent:PageLoading,delay:120});
const Packages=defineAsyncComponent({loader:()=>import('./Packages.vue'),loadingComponent:PageLoading,delay:120});
const History=defineAsyncComponent({loader:()=>import('./History.vue'),loadingComponent:PageLoading,delay:120});
const SceneLayers=defineAsyncComponent({loader:()=>import('./SceneLayers.vue'),loadingComponent:PageLoading,delay:120});
const ScenePreview=defineAsyncComponent({loader:()=>import('./ScenePreview.vue'),loadingComponent:PageLoading,delay:120});
const SceneInteractions=defineAsyncComponent({loader:()=>import('./SceneInteractions.vue'),loadingComponent:PageLoading,delay:120});
const interactionZone=ref('');
const MusicForm=defineAsyncComponent({loader:()=>import('./MusicForm.vue'),loadingComponent:PageLoading,delay:120});
const MediaForm=defineAsyncComponent({loader:()=>import('./MediaForm.vue'),loadingComponent:PageLoading,delay:120});
import { computed, ref, watch, onBeforeUnmount, onMounted, defineAsyncComponent, provide } from 'vue';

const sections = [
 ['texts','文案','按稳定 ID 修改对白、赠言和界面文字。',{}],
 ['scenes','场景','设置背景、行走区域和双向入口。',[]],
 ['interactions','互动','配置场景点位、反馈和小游戏入口。',[]],
 ['bundled','包内配置','查看随客户端发布的完整配置和点位。',null],
 ['gifts','礼物配置','按礼物 ID 修改内容、HTTPS 配图、坐标 x/y 和落脚点 point。',{}],
 ['resources','启动资源包','进入游戏时预下载这些文件。',[]],
 ['opening','定时开放','设置开放时间和可提前进入的公网 IP。',null],
 ['statistics','在线统计','启用后采集 IP、基础设备和访问时间，每 5 分钟更新一次在线状态。',{enabled:false}],
 ['notification','系统通知','游戏运行期间会定期同步。填写标题、正文并启用后发布。',{enabled:false,title:'',body:''}],
 ['announcement','游戏私告','启用后在玩家进入小屋时显示。',{enabled:false,title:'',body:''}],
 ['giftGames','礼物小游戏','以礼物 ID 绑定独立游戏的 HTTPS 地址。',{}],
 ['musicRoom','唱片房','设置在线歌单或自选曲目。',null],
 ['media','替换素材','设置礼物图片、回忆照片和演唱会音源。',{}],
 ['portals','传送门','配置桃源乡旁的两个网页入口。',[]],
 ['history','发布历史','查看历史、导入旧稿或回滚线上配置。',null],
 ['guide','项目文档','开发方法、发布 CLI、架构和构建说明。',null],
 ['storage','存储规则','设置大小阈值以及上传、下载的首选和备用位置。',null],
 ['packages','安装包','发布已构建的客户端，并提供下载入口。',null],
 ['assets','素材库','上传图片、音频和歌词，复制链接到发布配置。',null],
 ['all','配置总览','按栏目查看和修改配置。',{}],
];

const sectionGroups=[
 ['内容',['texts','scenes','interactions','gifts','giftGames','announcement','notification','opening','statistics','bundled','musicRoom','media','portals','all']],
 ['发布与资源',['history','packages','assets','resources','storage']],
 ['帮助',['guide']],
];
const labels=Object.fromEntries(sections.map(([id,label])=>[id,label]));
const base=import.meta.env.BASE_URL;
const publisherBuild=__PUBLISHER_BUILD__;
const publisherBuildTime=new Date(publisherBuild.builtAt).toLocaleString('zh-CN',{hour12:false});

const structuredFields={
 scenes:[['id','场景 ID'],['parent','父场景 ID'],['name','名称'],['caption','简介'],['background','背景 HTTPS 地址'],['entrance','父场景入口',2],['spawn','到达点',2],['exit','返回点',2],['floor','行走范围（左上 / 右下）',4]],
 interactions:[['id','互动 ID'],['zone','场景 ID'],['name','名称'],['action','按钮文案'],['response','反馈'],['x','图标 X',1],['y','图标 Y',1],['point','落脚点',2],['game','内置小游戏 ID'],['gameUrl','独立小游戏 HTTPS 地址'],['url','网页 HTTPS 地址']],
 resources:[['label','名称'],['url','资源地址']],
 portals:[['label','名称'],['url','网页 HTTPS 地址']],
};
const formSections=['texts','giftGames','musicRoom','media','gifts','announcement','notification','statistics',...Object.keys(structuredFields)];

  const durationLabel=seconds=>{const minutes=Math.floor((seconds??0)/60);return minutes>=60?Math.floor(minutes/60)+' 小时 '+minutes%60+' 分钟':minutes+' 分钟'};
  const statisticsColumns=[['ip','IP'],['platform','设备'],['userAgent','客户端'],['visits','进入次数'],['enteredAt','进入时间'],['lastSeenAt','最后在线']].map(([key,title])=>({key,title,ellipsis:{tooltip:true}})).concat([{key:'estimatedSeconds',title:'估算在线时长',render:row=>durationLabel(row.estimatedSeconds)}]);
  const statisticsReport=ref(null);
  const storageMode=ref('');
  async function readStatistics(){
   try{const response=await fetch(import.meta.env.BASE_URL+'api/statistics',{headers:{Authorization:'Bearer '+token.value.trim()}});if(!response.ok)throw Error('读取失败');statisticsReport.value=await response.json()}catch{statisticsReport.value={error:'暂时无法读取统计'}}
  }
  const sessionKey='lovehouse-publisher-session:'+base;
  function savedSession(){try{return sessionStorage.getItem(sessionKey)||''}catch{return ''}}
  const selected=ref('texts'), token=ref(savedSession()), draft=ref({}), revision=ref('');
  const bundled=ref({}),baseline=ref({}),summary=ref({added:0,modified:0,removed:0,total:0}),savedAt=ref(''),draftAvailable=ref(false);
  const storageKey='lovehouse-publisher-draft:'+import.meta.env.BASE_URL;
  provide('publisherToken',token);
  const username=ref(''),password=ref(''),loginError=ref(''),loggingIn=ref(false);
  async function login(){
   if(loggingIn.value)return;
   loggingIn.value=true;loginError.value='';
   try{
    const response=await fetch(import.meta.env.BASE_URL+'api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:username.value.trim(),password:password.value})});
    const data=await response.json();
    if(!response.ok)throw Error(data.error);
    token.value=data.session;password.value='';
   }catch(error){loginError.value=error.message||'登录失败'}
   finally{loggingIn.value=false}
  }
  async function logout(){
   const session=token.value;token.value='';authState.value='idle';
   await fetch(import.meta.env.BASE_URL+'api/logout',{method:'POST',headers:{Authorization:'Bearer '+session}}).catch(()=>{});
  }
  const publicRevision=ref(''), publicPackages=ref({}), authState=ref('idle');
  const draftRevision=ref(null);
  const conflict=computed(()=>loaded.value&&draftRevision.value!==revision.value);
  let authTimer,authController,hasEdited=false,refreshingEditor=false;
  const loaded=ref(false), form=ref(false), entries=ref([]), search=ref('');
  const records=ref([]),objectValue=ref({});
  const specialForm=computed(()=>form.value&&['musicRoom','media','gifts','announcement','notification','statistics'].includes(selected.value));
  const fields=computed(()=>selected.value==='interactions'?structuredFields.interactions.filter(([key])=>!['game','gameUrl','url'].includes(key)):structuredFields[selected.value]);
  const entryPage=ref(1),entryPageSize=24;
  const matchingEntries=computed(()=>entries.value.filter(row=>!search.value||row.key.includes(search.value)||row.value.includes(search.value)));
  const visibleEntries=computed(()=>matchingEntries.value.slice((entryPage.value-1)*entryPageSize,entryPage.value*entryPageSize));
  watch(search,()=>{entryPage.value=1});
  watch(()=>matchingEntries.value.length,count=>{entryPage.value=Math.min(entryPage.value,Math.max(1,Math.ceil(count/entryPageSize)))});
  const giftFields=[['name','名称'],['subtitle','副标题'],['message','赠言'],['variant','补充说明'],['image','配图 HTTPS 地址']];
  const giftIds=['moon','keychain','chestnuts','earphones','band','doll','chocolate','letter','notes','hat','labubu','mystery'];
  const builtinGift=id=>bundled.value.gifts?.[id]??{};
  function setGift(id,field,value){
   const fields={...objectValue.value[id]};
   if(value===undefined||value===null||value==='')delete fields[field];else fields[field]=value;
   if(Object.keys(fields).length)objectValue.value[id]=fields;else delete objectValue.value[id];
  }
  function setGiftPoint(id,index,value){
   const point=[...(objectValue.value[id]?.point??builtinGift(id).point??[320,350])];
   point[index]=value??builtinGift(id).point?.[index]??0;setGift(id,'point',point);
  }
  const bundledTab=ref('texts'),bundledQuery=ref('');
  const bundledRows=computed(()=>Object.entries(bundled.value[bundledTab.value]??{}).map(([key,value])=>({key,value,summary:typeof value==='string'?value:value?.name??value?.mode??key})).filter(row=>!bundledQuery.value||row.key.includes(bundledQuery.value)||String(row.summary).includes(bundledQuery.value)));
  const discardConfirm=ref(false),passwordOpen=ref(false),currentPassword=ref(''),newPassword=ref(''),passwordStatus=ref('');
  async function changePassword(){
   passwordStatus.value='';
   try{
    const r=await fetch(import.meta.env.BASE_URL+'api/password',{method:'POST',headers:{Authorization:'Bearer '+token.value,'Content-Type':'application/json'},body:JSON.stringify({current:currentPassword.value,next:newPassword.value})});
    const result=await r.json();if(!r.ok)throw Error(result.error);
    currentPassword.value='';newPassword.value='';passwordOpen.value=false;await logout();loginError.value='密码已修改，请重新登录。';
   }catch(error){passwordStatus.value=error.message}
  }
  async function discardDraft(){
   discardConfirm.value=false;
   if(!loaded.value)return;
   clearTimeout(saveTimer);saveTimer=undefined;
   draft.value=JSON.parse(JSON.stringify(baseline.value));
   draftRevision.value=revision.value;hasEdited=false;draftAvailable.value=false;savedAt.value='';
   try{localStorage.removeItem(storageKey)}catch{}
   refreshText();report('已放弃本机草稿',true);
  }
  const replaceConfirm=ref(false);
  const text=ref('{}'), status=ref(''), success=ref(false), busy=ref(false), confirm=ref(false);
  const section=computed(()=>sections.find(([id])=>id===selected.value));
  function collect(){
   if(['assets','history','packages','bundled','guide','all'].includes(selected.value))return;
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
    const existing=draft.value.texts??{};
    value=Object.fromEntries(selected.value==='texts'?pairs.filter(([key,value])=>Object.hasOwn(existing,key)||bundled.value.texts?.[key]!==value):pairs);
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
    if(response.status===401){loginError.value='登录已过期，请重新登录。';token.value='';return}
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
   const [content,packages]=await Promise.allSettled([read('content.json?features=animated-scenes-v1'),read('packages.json')]);
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
    if(response.status===401&&!controller.signal.aborted){loginError.value='登录已过期，请重新登录。';token.value='';return}
    if(!response.ok)throw Error(data.error||'认证失败');
    if(controller.signal.aborted)return;
    const {schema,revision:current,...config}=data;
    revision.value=current??'';publicRevision.value=revision.value;baseline.value=config;
    if(!hasEdited&&!draftAvailable.value){
     draft.value=structuredClone(config);draftRevision.value=revision.value;refreshText();
    }
    loaded.value=true;authState.value='ready';
    report('已载入线上配置。',true);
    void readBundled();
    storageMode.value='';
    void fetch(base+'api/storage',{headers:{Authorization:'Bearer '+token.value.trim()},signal:controller.signal,cache:'no-store'})
     .then(async response=>{if(response.ok&&!controller.signal.aborted)storageMode.value=(await response.json()).mode})
     .catch(()=>{});
   }catch(error){
    if(controller.signal.aborted)return;
    authState.value='error';report(error.message);
   }
  }
  watch(token,()=>{
   try{if(token.value)sessionStorage.setItem(sessionKey,token.value);else sessionStorage.removeItem(sessionKey)}catch{}
   authController?.abort();clearTimeout(authTimer);loaded.value=false;status.value='';
   authState.value=token.value.trim()?'checking':'idle';
   if(token.value.trim())void connect();
  },{flush:'sync',immediate:true});
  function rebaseDraft(){
   try{
    collect();saveLocal(true);draftRevision.value=revision.value;saveLocal();
    report('已更新草稿的发布基准，请核对差异后再发布。',true);
   }catch(error){report(error.message)}
  }
  const importInput=ref(null);
  const publishOptions=computed(()=>[
   {key:'load',label:'载入线上配置',disabled:busy.value||!loaded.value},
   {key:'import',label:'导入草稿'},
   {key:'export',label:'导出草稿'},
   {key:'restore',label:'恢复覆盖前草稿'},
   {key:'discard',label:'放弃草稿',disabled:busy.value||!loaded.value},
   {type:'divider',key:'divider'},
   {key:'rebase',label:'确认当前发布基准',disabled:!conflict.value},
   {key:'check',label:'校验草稿',disabled:busy.value||!loaded.value},
   {key:'publish',label:'发布',disabled:busy.value||!loaded.value||conflict.value},
  ]);
  function publishingAction(key){
   const actions={load:()=>replaceConfirm.value=true,import:()=>importInput.value?.click(),export:exportDraft,restore:()=>restoreLocal(true),discard:()=>discardConfirm.value=true,rebase:rebaseDraft,check:()=>request('check'),publish:review};
   actions[key]?.();
  }
  function review(){
   try{collect();summary.value=configurationChanges(baseline.value,draft.value,bundled.value);confirm.value=true}
   catch(e){report(e.message)}
  }
  function importHistory(snapshot){
   saveLocal(true);const {schema,revision:old,...config}=snapshot;draft.value=config;hasEdited=true;draftRevision.value=old??null;selected.value='all';form.value=false;refreshText();saveLocal();report('历史版本已载入草稿，发布前请校验。',true);
  }
</script>

<template>
<main v-if="!token" class="publisher-login">
 <n-card title="生日小屋 · 内容发布后台" class="login-card">
  <n-form @submit.prevent="login" label-placement="top">
   <n-form-item label="账号"><n-input v-model:value="username" :input-props="{autocomplete:'username'}"/></n-form-item>
   <n-form-item label="密码"><n-input v-model:value="password" type="password" show-password-on="click" :input-props="{autocomplete:'current-password'}"/></n-form-item>
   <p v-if="loginError" role="alert">{{loginError}}</p>
   <n-button block type="primary" attr-type="submit" :loading="loggingIn" :disabled="!username.trim()||!password">登录</n-button>
  </n-form>
 </n-card>
</main>
<AdminLayout v-else :groups="sectionGroups" :labels="labels" :selected="selected" @select="choose">
 <template #header>
  <div class="identity"><div><strong>{{labels[selected]}}</strong><small>内容发布后台</small></div></div>
  <div class="top-actions">
   <input ref="importInput" type="file" accept=".json,application/json" hidden @change="importDraft">
   <div class="desktop-publish-actions">
    <IconButton label="校验草稿" :icon="checkIcon" size="small" :disabled="busy||!loaded" @click="publishingAction('check')"/>
    <IconButton label="发布" :icon="publishIcon" size="small" type="primary" :disabled="busy||!loaded||conflict" @click="publishingAction('publish')"/>
   </div>
   <n-dropdown trigger="click" placement="bottom-end" :options="publishOptions" @select="publishingAction">
    <n-button size="small" class="publishing-menu" aria-label="草稿与发布操作"><span class="publishing-menu-text">草稿操作</span><span class="publishing-menu-dots" aria-hidden="true">⋯</span></n-button>
   </n-dropdown>

   <n-tag :type="authState==='ready'?'success':authState==='error'?'error':'info'">{{{idle:'访客',checking:'正在验证',ready:'已认证',error:'认证失败'}[authState]}}</n-tag>
   <IconButton label="修改密码" :icon="keyIcon" size="small" @click="passwordOpen=true"/><IconButton label="退出登录" :icon="logoutIcon" size="small" @click="logout"/>
  </div>
 </template>
 <template #status>
  <div class="banner-versions" aria-label="线上版本">
   <span :title="publisherBuild.builtAt">后台 <b>{{publisherBuild.revision}}</b> <small>{{publisherBuildTime}}</small></span>
   <span>CLI <b>{{publisherBuild.cli}}</b></span>
   <span>Skill <b>{{publisherBuild.skill}}</b></span>
   <span>内容 <b>{{publicRevision.slice(0,12)||'—'}}</b></span>
   <span>Android <b>{{publicPackages.android?.version||'—'}}</b></span>
   <span>Windows <b>{{publicPackages.windows?.version||'—'}}</b></span>
   <span v-if="storageMode">存储 <b>{{storageMode==='s3'?'对象存储':'本地磁盘'}}</b></span>
  </div>
  <div v-if="authState==='checking'" class="banner-item" role="status"><n-spin :size="14"/><span>正在同步配置</span></div>
  <n-tag v-if="status" size="small" :type="success?'success':'error'">{{status}}</n-tag>
  <n-tag v-if="conflict" size="small" type="warning">发布基准已变化 <n-button text size="tiny" @click="rebaseDraft">确认基准</n-button></n-tag>
  <n-tag v-if="draftAvailable" size="small" type="info">有未发布草稿 <n-button text size="tiny" @click="restoreLocal">恢复</n-button><n-button text size="tiny" :disabled="!loaded" @click="discardConfirm=true">放弃</n-button></n-tag>
  <small v-if="savedAt" class="draft-status">草稿保存于 {{savedAt}}</small>
 </template>
 <div class="workspace-main">
  <section class="editor">
   <div class="heading"><div><h1>{{section[1]}}</h1><p>{{section[2]}}</p></div></div>
   <template v-if="selected==='guide'"><Guide/></template>
   <StorageRules v-else-if="selected==='storage'" :token="token" @bucket-saved="storageMode='s3'"/>
   <OpeningRules v-else-if="selected==='opening'" :token="token"/>
   <template v-else-if="selected==='packages'">
    <Packages :token="token" @updated="refreshPublic"/>
   </template>
   <template v-else-if="selected==='assets'">
    <Assets :token="token"/>
   </template>
   <template v-else-if="selected==='history'">
    <History :token="token" :revision="revision" @import="importHistory" @restore="connect"/>
   </template>
   <template v-else>
   <div v-if="formSections.includes(selected) && selected!=='interactions'" class="actions"><n-button v-if="form && fields" @click="addRecord">新增条目</n-button><template v-else-if="form && !specialForm"><n-input v-model:value="search" clearable placeholder="搜索 ID 或内容" aria-label="搜索条目"/><n-button @click="search=''; entries.push({key:'',value:''})">新增条目</n-button></template></div>
   <MusicForm v-if="specialForm && selected==='musicRoom'" v-model="objectValue"/>
   <MediaForm v-else-if="specialForm && selected==='media'" v-model="objectValue"/>
   <SceneInteractions v-else-if="selected==='interactions'" v-model="records" :scenes="draft.scenes" :worlds="bundled.worlds" :initial-zone="interactionZone"/>
   <div v-else-if="form && fields" class="record-list">
    <details v-for="(record,index) in records" :key="record" class="record">
     <summary>{{ record.name || record.label || record.id || '新条目' }}</summary>
     <ScenePreview v-if="selected==='scenes'" :scene="record" @update:scene="value=>records[index]=value"/>
     <SceneLayers v-if="selected==='scenes'" v-model="record.layers" :zone="record.id" :interactions="draft.interactions??[]"/>
     <n-button v-if="selected==='scenes' && record.id && record.id!=='cloud-'" size="small" @click="interactionZone=record.id; choose('interactions')">管理此场景的互动</n-button>

     <div class="record-fields">
      <div v-for="[key,label,size] in fields" :key="key" class="field">
       <span>{{label}}</span>
       <ResourceLink v-if="!size && ['url','background'].includes(key)" v-model:value="record[key]" :accept="key==='background'?'image/*':selected==='resources'?undefined:'.html'"/>
       <n-input v-else-if="!size" v-model:value="record[key]" :aria-label="label"/>
       <n-input-number v-else-if="size===1" v-model:value="record[key]" :aria-label="label" :controls="false" :min="0" :max="key==='x'?640:426"/>
       <div v-else class="coordinates">
        <n-input-number v-for="n in size" :key="n" v-model:value="record[key][n-1]" :aria-label="label+' '+n" :controls="false" :min="0" :max="n%2?640:426"/>
       </div>
      </div>
      <n-button text type="error" @click="records.splice(index,1)">移除条目</n-button>
     </div>
    </details>
    <p v-if="!records.length" class="empty">暂无条目，可新增或导入草稿。</p>
   </div>
   <div v-else-if="form && !specialForm" class="entry-list">
    <div v-for="row in visibleEntries" :key="entries.indexOf(row)" class="entry">
     <n-input v-model:value="row.key" aria-label="稳定 ID" placeholder="稳定 ID"/>
     <ResourceLink v-if="selected==='giftGames'" v-model:value="row.value" accept=".html"/>
     <n-input v-else v-model:value="row.value" :type="selected==='texts'?'textarea':'text'" aria-label="内容" :placeholder="selected==='texts'?'文字':'HTTPS 地址'"/>
     <n-button text type="error" @click="entries.splice(entries.indexOf(row),1)">移除</n-button>
    </div>
    <n-pagination v-if="matchingEntries.length>entryPageSize" v-model:page="entryPage" :page-size="entryPageSize" :item-count="matchingEntries.length" :page-slot="5"/>
    <p v-if="!visibleEntries.length" class="empty">{{search?'没有匹配条目':'暂无条目，可新增或导入草稿。'}}</p>
   </div>
   <n-collapse v-else-if="selected==='gifts'" accordion>
    <n-collapse-item v-for="id in giftIds" :key="id" :name="id" :title="objectValue[id]?.name||builtinGift(id).name||id">
     <n-form label-placement="top">
      <n-form-item v-for="[key,label] in giftFields" :key="key" :label="label">
       <ResourceLink v-if="key==='image'" :value="objectValue[id]?.image??''" accept="image/*" @update:value="value=>setGift(id,key,value)"/>
       <n-input v-else :value="objectValue[id]?.[key]??''" :placeholder="builtinGift(id)[key]||'填写覆盖值'" :type="key==='message'?'textarea':'text'" @update:value="value=>setGift(id,key,value)"/>
      </n-form-item>
      <div class="coordinates">
       <n-form-item v-for="[axis,max] in [['x',640],['y',426]]" :key="axis" :label="'展示 '+axis.toUpperCase()">
        <n-input-number :value="objectValue[id]?.[axis]??null" :placeholder="String(builtinGift(id)[axis]??'')" :min="0" :max="max" @update:value="value=>setGift(id,axis,value)"/>
       </n-form-item>
       <n-form-item v-for="index in [0,1]" :key="index" :label="index===0?'落脚点 X':'落脚点 Y'">
        <n-input-number :value="objectValue[id]?.point?.[index]??null" :placeholder="String(builtinGift(id).point?.[index]??'')" :min="0" :max="index===0?640:426" @update:value="value=>setGiftPoint(id,index,value)"/>
       </n-form-item>
      </div>
      <n-button size="small" :disabled="!objectValue[id]" @click="delete objectValue[id]">恢复此礼物的包内配置</n-button>
     </n-form>
    </n-collapse-item>
   </n-collapse>
   <n-form v-else-if="selected==='announcement'||selected==='notification'" label-placement="top">
    <n-form-item label="启用"><n-switch v-model:value="objectValue.enabled"/></n-form-item>
    <n-form-item label="标题"><n-input v-model:value="objectValue.title" :maxlength="80"/></n-form-item>
    <n-form-item label="正文"><n-input v-model:value="objectValue.body" type="textarea" :maxlength="4000" :autosize="{minRows:5,maxRows:12}"/></n-form-item>
   </n-form>
   <template v-else-if="selected==='statistics'"><label class="stats-switch"><n-switch v-model:value="objectValue.enabled"/> 启用统计</label><IconButton label="刷新在线统计" :icon="refreshIcon" @click="readStatistics"/><template v-if="statisticsReport"><p>{{statisticsReport.error||('当前在线 '+statisticsReport.online+' 台设备 · 7 天内 '+statisticsReport.sessions.length+' 台去重设备 · 估算总在线 '+durationLabel(statisticsReport.totalEstimatedSeconds))}}</p><small>按 IP、设备和客户端合并，重叠会话不重复累计。每次心跳最多推算后续 5 分钟，统计保留 7 天。</small><n-data-table v-if="statisticsReport.sessions" :data="statisticsReport.sessions" :columns="statisticsColumns" :pagination="{pageSize:20}" :scroll-x="780"/></template></template>
   <section v-else-if="selected==='bundled'" class="bundled-browser">
    <n-tabs v-model:value="bundledTab" type="line">
     <n-tab-pane v-for="[id,title] in [['texts','文案'],['worlds','场景与互动'],['gifts','礼物'],['media','媒体'],['musicRoom','歌单'],['announcement','游戏私告']]" :key="id" :name="id" :tab="title"/>
    </n-tabs>
    <n-input v-model:value="bundledQuery" clearable placeholder="搜索名称、内容或 ID"/>
    <n-data-table v-if="bundledTab==='texts'" :data="bundledRows" :columns="[{key:'key',title:'文案 ID',width:235},{key:'summary',title:'包内文案'}]" :scroll-x="420" :pagination="{pageSize:16,pageSlot:5}"/>
    <n-collapse v-else>
     <n-collapse-item v-for="row in bundledRows" :key="row.key" :name="row.key" :title="row.summary">
      <dl v-if="row.value && typeof row.value==='object'" class="bundled-fields">
       <template v-for="(value,key) in row.value" :key="key"><dt>{{key}}</dt><dd><ul v-if="Array.isArray(value) && value.some(v=>typeof v==='object')"><li v-for="(part,index) in value" :key="index">{{part?.name||part?.title||part?.id||part?.join?.(' / ')||part}}</li></ul><span v-else>{{Array.isArray(value)?value.join(' / '):value}}</span></dd></template>
      </dl><p v-else>{{row.value}}</p>
     </n-collapse-item>
    </n-collapse>
    <p v-if="!bundledRows.length">没有可显示的包内条目。</p>
   </section>
   <div v-else-if="selected==='all'" class="config-links"><n-card v-for="[id,title,help] in sections.filter(([id])=>!['all','guide','assets','history','packages'].includes(id))" :key="id" :title="title" size="small"><p>{{help}}</p><n-button size="small" @click="choose(id)">打开{{title}}</n-button></n-card></div>

   </template>
  </section>
 </div>
 <publisher-dialog v-model="replaceConfirm" title="载入线上配置？" width="min(440px,94vw)"><p>当前草稿会先保存到本机，然后载入线上内容。</p><template #footer><n-button @click="replaceConfirm=false">取消</n-button><n-button type="primary" @click="saveLocal(true); replaceConfirm=false; request('snapshot')">载入</n-button></template></publisher-dialog>
 <publisher-dialog v-model="confirm" title="发布当前草稿？" width="min(440px, 94vw)"><p>玩家下次启动时会同步此配置。</p><p>修改配置 {{summary.total}} 条</p><p>新增 {{summary.added}} 条 · 修改 {{summary.modified}} 条 · 删除 {{summary.removed}} 条</p><template #footer><n-button @click="confirm=false">取消</n-button><n-button type="primary" @click="confirm=false; request('publish')">确认发布</n-button></template></publisher-dialog>
<publisher-dialog v-model="discardConfirm" title="放弃本机草稿？"><p>当前未发布改动会清除，编辑器恢复到已读取的线上版本。</p><template #footer><n-button @click="discardConfirm=false">取消</n-button> <n-button type="error" @click="discardDraft">放弃草稿</n-button></template></publisher-dialog>
 <publisher-dialog v-model="passwordOpen" title="修改密码">
  <n-form label-placement="top" @submit.prevent="changePassword">
   <n-form-item label="当前密码"><n-input v-model:value="currentPassword" type="password" :input-props="{autocomplete:'current-password'}"/></n-form-item>
   <n-form-item label="新密码（至少 12 字符）"><n-input v-model:value="newPassword" type="password" :input-props="{autocomplete:'new-password'}"/></n-form-item>
   <p v-if="passwordStatus" role="alert">{{passwordStatus}}</p>
   <n-button type="primary" attr-type="submit" :disabled="!currentPassword||newPassword.length<12">保存密码</n-button>
  </n-form>
 </publisher-dialog>
</AdminLayout>
 </template>
