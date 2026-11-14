<script setup>
import {NTabs,NTabPane,NCard} from 'naive-ui';
import architecture from './guide/architecture.md?raw';
import development from './guide/development.md?raw';
import cli from './guide/cli.md?raw';
import actions from './guide/actions.md?raw';
import agent from './guide/Agent.MD?raw';

const pages=[['development','开发方法',development],['cli','发布 CLI',cli],['architecture','架构与模块',architecture],['actions','GitHub Actions',actions],['agent','Agent.MD',agent]];
function sections(source){
 return source.split(/(?=^#{1,3} )/m).map(block=>{
  const [first,...rest]=block.split('\n');
  return {title:first.startsWith('#')?first.replace(/^#+ /,''):'',body:(first.startsWith('#')?rest.join('\n'):block).trim()};
 }).filter(section=>section.title||section.body);
}
</script>
<template>
 <n-tabs type="line">
  <n-tab-pane v-for="[key,title,source] in pages" :key="key" :name="key" :tab="title">
   <n-card v-for="(section,index) in sections(source)" :key="index" :title="section.title||undefined" size="small" class="guide-section">
    <pre>{{section.body}}</pre>
   </n-card>
   <a :href="'data:text/markdown;charset=utf-8,'+encodeURIComponent(source)" :download="key==='agent'?'Agent.MD':key+'.md'">下载原文</a>
  </n-tab-pane>
 </n-tabs>
</template>
<style scoped>
.guide-section{margin-bottom:12px}.guide-section pre{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font-family:inherit;line-height:1.8}
</style>
