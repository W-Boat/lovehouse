<script setup>
import {NButton,NEmpty,NForm,NInput,NRadioButton,NRadioGroup,NTag} from 'naive-ui';
import {PublisherAlert,PublisherFormItem,PublisherOption,PublisherSelect} from './publisher-components.js';
import {computed} from 'vue';
import initial from '../content/music-room.json';
import {validateCloudPlaylist} from '../content/cloud-playlist.mjs';

const props=defineProps({modelValue:{type:Object,default:null}});
const emit=defineEmits(['update:modelValue']);
const fallback=()=>JSON.parse(JSON.stringify(initial));
const config=computed(()=>({...fallback(),...(props.modelValue??{})}));
const inherited=computed(()=>props.modelValue===null||props.modelValue===undefined);
const tracks=computed(()=>Array.isArray(config.value.localTracks)?config.value.localTracks:[]);
const validation=computed(()=>{
 if(inherited.value)return '';
 try{validateCloudPlaylist(props.modelValue);return ''}
 catch(error){return error.message}
});
function update(patch){emit('update:modelValue',{...config.value,...patch})}
function changeTrack(index,key,value){
 const next=tracks.value.map((track,i)=>i===index?{...track,[key]:value}:{...track});
 update({localTracks:next});
}
function addTrack(){update({localTracks:[...tracks.value.map(track=>({...track})),{name:'',artist:'',url:'',cover:'',lrc:''}]})}
function removeTrack(index){update({localTracks:tracks.value.filter((_,i)=>i!==index).map(track=>({...track}))})}
function moveTrack(index,offset){
 const next=tracks.value.map(track=>({...track}));
 [next[index],next[index+offset]]=[next[index+offset],next[index]];
 update({localTracks:next});
}
const platformNames={tencent:'QQ 音乐',netease:'网易云音乐',kugou:'酷狗音乐'};
const trackFields=[['name','曲名','填写歌曲名称',100],['artist','演唱者 / 作者','填写演唱者或作者',100],['url','音源地址','HTTPS 地址或包内 audio/、music/ 路径',2048],['cover','封面地址','可留空，支持 HTTPS 或 assets/ 路径',2048],['lrc','LRC 歌词地址','纯音乐可留空',2048]];
</script>

<template>
 <section class="music-config">
  <div class="music-config-toolbar">
   <div><strong>播放来源</strong><p>设置玩家走进唱片房时使用的歌单。玩家保存的自选歌单仍由玩家控制。</p></div>
   <n-button v-if="!inherited" @click="emit('update:modelValue',null)">使用客户端默认歌单</n-button>
   <n-tag v-else type="info" effect="plain">跟随客户端默认值</n-tag>
  </div>
  <n-radio-group :value="config.mode" aria-label="播放来源" @update:value="value=>update({mode:value})">
   <n-radio-button value="offline">自选曲目 / 内置唱片</n-radio-button>
   <n-radio-button value="online">在线平台歌单</n-radio-button>
  </n-radio-group>
  <publisher-alert v-if="inherited" type="info" :closable="false" title="当前使用客户端默认歌单。修改下方字段后会创建云端配置。"/>
  <n-form label-placement="top" class="music-source-form">
   <publisher-form-item label="音乐平台"><publisher-select :value="config.server" aria-label="音乐平台" @update:value="value=>update({server:value})"><publisher-option v-for="(label,value) in platformNames" :key="value" :label="label" :value="value"/></publisher-select></publisher-form-item>
   <publisher-form-item label="内容类型"><publisher-select :value="config.type" aria-label="内容类型" @update:value="value=>update({type:value})"><publisher-option label="歌单" value="playlist"/><publisher-option label="专辑" value="album"/><publisher-option label="单曲" value="song"/></publisher-select></publisher-form-item>
   <publisher-form-item label="歌单、专辑或单曲 ID"><n-input :value="config.id" maxlength="64" placeholder="填写平台上的内容 ID" aria-label="歌单、专辑或单曲 ID" @update:value="value=>update({id:value})"/></publisher-form-item>
   <publisher-form-item label="Meting API" class="music-api"><n-input :value="config.api" maxlength="2048" placeholder="HTTPS API，可保留 :server、:type、:id、:r 占位符" aria-label="Meting API" @update:value="value=>update({api:value})"/></publisher-form-item>
  </n-form>
  <div class="music-tracks-heading"><div><h3>自选曲目</h3><p>{{config.mode==='offline'?'按下方顺序播放。':'切换到自选曲目时使用下方列表。'}}网络音源需要联网。</p></div><n-button :disabled="tracks.length>=60" @click="addTrack">添加曲目</n-button></div>
  <n-empty v-if="!tracks.length" description="添加至少一首曲目以使用自选播放来源" :image-size="70"/>
  <div class="music-tracks">
   <article v-for="(track,index) in tracks" :key="index" class="music-track">
    <header><strong>{{track.name||'待填写曲目'}}</strong><div class="music-track-actions"><n-button text :disabled="index===0" :aria-label="'上移曲目 '+(index+1)" @click="moveTrack(index,-1)">上移</n-button><n-button text :disabled="index===tracks.length-1" :aria-label="'下移曲目 '+(index+1)" @click="moveTrack(index,1)">下移</n-button><n-button text type="error" :aria-label="'移除曲目 '+(index+1)" @click="removeTrack(index)">移除</n-button></div></header>
    <n-form label-placement="top" class="music-track-fields">
     <publisher-form-item v-for="[key,label,placeholder,maxlength] in trackFields" :key="key" :label="label" :class="{'music-track-wide':key==='url'}"><n-input :value="track[key]??''" :maxlength="maxlength" :placeholder="placeholder" :aria-label="label+' '+(index+1)" @update:value="value=>changeTrack(index,key,value)"/></publisher-form-item>
    </n-form>
   </article>
  </div>
  <publisher-alert v-if="validation" type="warning" :closable="false" :title="validation" description="请完成字段后，再使用页面下方的校验草稿。"/>
 </section>
</template>

<style scoped>
.music-config{display:grid;gap:18px}.music-config-toolbar,.music-tracks-heading,.music-track header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.music-config p{margin:6px 0 0;color:#617066;font-size:13px;line-height:1.6}.music-config h3{margin:0;font-size:17px}.music-source-form,.music-track-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px}.music-api,.music-track-wide{grid-column:1/-1}.music-tracks{display:grid;gap:12px}.music-track{padding:16px;border:1px solid #dce4dc;background:#f7f9f6;border-radius:10px}.music-track header{margin-bottom:12px}.music-track strong{overflow-wrap:anywhere}.music-track-actions{display:flex;align-items:center;gap:4px}.music-track-actions .n-button+.n-button{margin-left:0}.music-source-form :deep(.n-form-item),.music-track-fields :deep(.n-form-item){margin-bottom:14px}.music-source-form :deep(.n-select){width:100%}@media(max-width:600px){.music-source-form,.music-track-fields{grid-template-columns:1fr}.music-track{padding:12px}.music-config :deep(.n-radio-group){display:flex;flex-wrap:wrap;row-gap:8px}}
</style>
