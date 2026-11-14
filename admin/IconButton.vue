<script setup>
import {NButton,NIcon,NTooltip} from 'naive-ui';
defineOptions({inheritAttrs:false});
defineProps({label:{type:String,required:true},icon:{type:Object,required:true}});
</script>
<template>
 <n-tooltip>
  <template #trigger>
   <n-button v-bind="$attrs" :aria-label="label" class="admin-icon-button">
    <template #icon><n-icon><svg :viewBox="'0 0 '+(icon.width||24)+' '+(icon.height||24)" v-html="icon.body" aria-hidden="true"/></n-icon></template>
   </n-button>
  </template>
  {{label}}
 </n-tooltip>
</template>
