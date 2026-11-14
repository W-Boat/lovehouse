<script setup>
import MarkdownIt from 'markdown-it';
import {NTabs,NTabPane,NCard,NButton,NIcon} from 'naive-ui';
import downloadIcon from '@iconify-icons/mdi/download-outline';
const skillUrl=import.meta.env.BASE_URL+'assets/lovehouse-skill.zip';
import dynamicScenes from '../docs/动态场景与热补丁.md?raw';
import fullCli from '../docs/完整发布CLI.md?raw';
import architecture from './guide/architecture.md?raw';
import development from './guide/development.md?raw';
import cli from './guide/cli.md?raw';
import actions from './guide/actions.md?raw';
import agent from './guide/Agent.MD?raw';

const pages=[['dynamic','动态场景与补丁',dynamicScenes],['full-cli','完整 CLI',fullCli],['development','开发方法',development],['cli','发布 CLI',cli],['architecture','架构与模块',architecture],['actions','GitHub Actions',actions],['agent','Agent.MD',agent]];
const markdown=new MarkdownIt({html:false,linkify:true});
const renderedPages=pages.map(([key,title,source])=>({key,title,source,html:markdown.render(source)}));
</script>
<template>
 <n-card size="small" class="guide-section" title="Agent 接入">
  <p>下载并解压技能包。将 .ENV.example 复制为 .ENV，填写本机仓库路径和发布令牌。后台服务器地址已预填。</p>
  <n-button tag="a" :href="skillUrl" download="lovehouse-skill.zip" type="primary">
   <template #icon><n-icon><svg viewBox="0 0 24 24" v-html="downloadIcon.body" aria-hidden="true"/></n-icon></template>
   下载 lovehouse-skill
  </n-button>
 </n-card>
 <n-tabs type="line">
  <n-tab-pane v-for="{key,title,source,html} in renderedPages" :key="key" :name="key" :tab="title">
   <n-card size="small" class="guide-section">
    <article class="guide-markdown" v-html="html"/>
   </n-card>
   <a :href="'data:text/markdown;charset=utf-8,'+encodeURIComponent(source)" :download="key==='agent'?'Agent.MD':key+'.md'">下载原文</a>
  </n-tab-pane>
 </n-tabs>
</template>
<style scoped>
.guide-section{margin-bottom:12px}
.guide-markdown{font-size:15px;line-height:1.75;overflow-wrap:anywhere}
.guide-markdown :deep(h1),.guide-markdown :deep(h2),.guide-markdown :deep(h3){line-height:1.35;margin:1.25em 0 .55em}
.guide-markdown :deep(h1:first-child){margin-top:0}
.guide-markdown :deep(pre),.guide-markdown :deep(table){display:block;overflow-x:auto;max-width:100%}
.guide-markdown :deep(pre){background:#edf3ef;padding:14px;border-radius:8px;white-space:pre}
.guide-markdown :deep(code){font-family:ui-monospace,Consolas,monospace}
.guide-markdown :deep(p code),.guide-markdown :deep(li code){background:#edf3ef;padding:2px 4px;border-radius:3px}
.guide-markdown :deep(table){border-collapse:collapse}
.guide-markdown :deep(th),.guide-markdown :deep(td){border:1px solid #dce6df;padding:6px 10px;text-align:left}
.guide-markdown :deep(blockquote){margin-inline:0;border-left:3px solid #78a18d;padding-left:12px;color:#54695f}
</style>
