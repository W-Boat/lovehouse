<!-- Adapted from vue-naive-admin 2.x normal layout. Copyright (c) 2023 Ronnie Zhang. -->
<script setup>
import {sakuraTheme as themeOverrides} from './sakura-theme.js';
import {computed,h,ref,onMounted,onBeforeUnmount} from 'vue';
import {NConfigProvider,NLayout,NLayoutSider,NScrollbar,NMenu,NIcon,NDrawer,NDrawerContent,zhCN,dateZhCN} from 'naive-ui';

import menuIconData from '@iconify-icons/mdi/menu';
import IconButton from './IconButton.vue';
import file from '@iconify-icons/mdi/file-document-outline';
import image from '@iconify-icons/mdi/image-multiple-outline';
import chart from '@iconify-icons/mdi/chart-timeline-variant';
import packageIcon from '@iconify-icons/mdi/package-variant-closed';
import book from '@iconify-icons/mdi/book-open-page-variant-outline';
import scenesIcon from '@iconify-icons/mdi/map-outline';
import interactionsIcon from '@iconify-icons/mdi/gesture-tap';
import giftsIcon from '@iconify-icons/mdi/gift-outline';
import giftGamesIcon from '@iconify-icons/mdi/gamepad-variant-outline';
import announcementIcon from '@iconify-icons/mdi/bullhorn-outline';
import notificationIcon from '@iconify-icons/mdi/bell-outline';
import bundledIcon from '@iconify-icons/mdi/archive-outline';
import musicRoomIcon from '@iconify-icons/mdi/music-note';
import mediaIcon from '@iconify-icons/mdi/image-outline';
import portalsIcon from '@iconify-icons/mdi/door-open';
import allIcon from '@iconify-icons/mdi/cog-outline';
import historyIcon from '@iconify-icons/mdi/history';
import homeIcon from '@iconify-icons/mdi/home-heart';
const icons={storage:bundledIcon,opening:historyIcon,assets:image,statistics:chart,packages:packageIcon,guide:book,scenes:scenesIcon,interactions:interactionsIcon,gifts:giftsIcon,giftGames:giftGamesIcon,announcement:announcementIcon,notification:notificationIcon,bundled:bundledIcon,musicRoom:musicRoomIcon,media:mediaIcon,portals:portalsIcon,all:allIcon,history:historyIcon};
const homeMarkup=homeIcon.body;
const menuIcon=key=>()=>h(NIcon,null,{default:()=>h('svg',{viewBox:'0 0 24 24',innerHTML:(icons[key]??file).body})});
const props=defineProps({groups:Array,labels:Object,selected:String});
const emit=defineEmits(['select']);
const drawerWidth=ref(184);
const collapsed=ref(false),mobile=ref(false),drawer=ref(false);
const media=window.matchMedia('(max-width: 760px)');
const measure=()=>{mobile.value=media.matches;drawerWidth.value=Math.min(196,Math.round(window.innerWidth*.54));drawer.value=false};
const resizeDrawer=()=>{drawerWidth.value=Math.min(196,Math.round(window.innerWidth*.54))};
measure();onMounted(()=>{media.addEventListener('change',measure);window.addEventListener('resize',resizeDrawer)});
onBeforeUnmount(()=>{media.removeEventListener('change',measure);window.removeEventListener('resize',resizeDrawer)});
function select(key){drawer.value=false;emit('select',key)}
function toggle(){if(mobile.value)drawer.value=!drawer.value;else collapsed.value=!collapsed.value}
const options=computed(()=>props.groups.map(([label,ids])=>({
 type:'group',label,key:label,children:ids.map(key=>({key,label:props.labels[key],icon:menuIcon(key)})),
})));
</script>

<template>
 <n-config-provider :locale="zhCN" :date-locale="dateZhCN" :theme-overrides="themeOverrides">
  <n-layout has-sider class="naive-admin">
   <n-layout-sider v-if="!mobile" bordered collapse-mode="width" :collapsed-width="60" :width="224" :collapsed="collapsed" class="naive-sidebar">
    <div class="naive-brand"><span class="mark" aria-hidden="true"><n-icon size="23"><svg viewBox="0 0 24 24" v-html="homeMarkup"/></n-icon></span><strong v-if="!collapsed">生日小屋</strong></div>
    <n-scrollbar class="sidebar-menu-scroll"><n-menu :options="options" :value="selected" :collapsed="collapsed" :collapsed-width="60" :collapsed-icon-size="22" @update:value="select"/></n-scrollbar>
   </n-layout-sider>
   <n-layout class="naive-work-area">
    <header class="naive-header">
     <IconButton quaternary label="切换后台导航" :icon="menuIconData" :aria-expanded="mobile?drawer:!collapsed" @click="toggle"/>
     <slot name="header"/>
    </header>
    <div class="publisher-status-banner"><slot name="status"/></div>
    <main class="naive-content"><slot/></main>
   </n-layout>
  </n-layout>
  <n-drawer v-model:show="drawer" placement="left" :width="drawerWidth">
   <n-drawer-content title="生日小屋" closable :native-scrollbar="false"><n-menu :options="options" :value="selected" @update:value="select"/></n-drawer-content>
  </n-drawer>
 </n-config-provider>
</template>
