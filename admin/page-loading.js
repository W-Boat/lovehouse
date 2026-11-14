import {h} from 'vue';
import {NSpin} from 'naive-ui';
export default {render:()=>h('div',{class:'admin-loading',role:'status'},[h(NSpin,{size:'small'}),h('span','正在加载页面…')])};
