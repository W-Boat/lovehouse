<!-- Adapted from vue-naive-admin 2.x normal layout. Copyright (c) 2023 Ronnie Zhang. -->
<script setup>
import {computed,h,ref} from 'vue';
import {NButton,NConfigProvider,NLayout,NLayoutSider,NMenu,NIcon,zhCN,dateZhCN} from 'naive-ui';

import file from '@iconify-icons/mdi/file-document-outline';
import image from '@iconify-icons/mdi/image-multiple-outline';
import chart from '@iconify-icons/mdi/chart-timeline-variant';
import packageIcon from '@iconify-icons/mdi/package-variant-closed';
import book from '@iconify-icons/mdi/book-open-page-variant-outline';
const icons={assets:image,statistics:chart,packages:packageIcon,guide:book};
const menuIcon=key=>()=>h(NIcon,null,{default:()=>h('svg',{viewBox:'0 0 24 24',innerHTML:(icons[key]??file).body})});
const props=defineProps({groups:Array,labels:Object,selected:String});
const emit=defineEmits(['select']);
const collapsed=ref(false);
const options=computed(()=>props.groups.map(([label,ids])=>({
 type:'group',label,key:label,children:ids.map(key=>({key,label:props.labels[key],icon:menuIcon(key)})),
})));
const themeOverrides={common:{primaryColor:'#28624e',primaryColorHover:'#397d64',primaryColorPressed:'#1b4a3a',borderRadius:'7px'}};
</script>

<template>
 <n-config-provider :locale="zhCN" :date-locale="dateZhCN" :theme-overrides="themeOverrides">
  <n-layout has-sider class="naive-admin">
   <n-layout-sider bordered collapse-mode="width" :collapsed-width="0" :width="224" :collapsed="collapsed" class="naive-sidebar">
    <div class="naive-brand"><span class="mark" aria-hidden="true">小</span><strong>生日小屋</strong></div>
    <n-menu :options="options" :value="selected" @update:value="emit('select',$event)"/>
   </n-layout-sider>
   <n-layout>
    <header class="naive-header">
     <n-button quaternary aria-label="切换后台导航" :aria-expanded="!collapsed" @click="collapsed=!collapsed">菜单</n-button>
     <slot name="header"/>
    </header>
    <main class="naive-content"><slot/></main>
   </n-layout>
  </n-layout>
 </n-config-provider>
</template>
