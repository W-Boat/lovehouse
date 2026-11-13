import {useSaveStore} from './src/stores/useSaveStore';
import {useGameStore} from './src/stores/useGameStore';
import router from './src/router';
export function installLovehouseBridge(){
 if(window.parent===window)return;
 let role='offline',applying=false,timer=0;
 const post=(payload:unknown)=>parent.postMessage({channel:'lovehouse-taoyuan',type:'event',payload},location.origin);
 const snapshot=()=>{if(role==='guest'||applying||!useGameStore().isGameStarted)return;const store=useSaveStore();if(store.saveToSlot(0)){const save=localStorage.getItem('taoyuanxiang_save_0');if(save)post({kind:'state',save,route:router.currentRoute.value.fullPath})}};
 document.addEventListener('click',event=>{const button=(event.target as Element).closest('button');if(!button)return;if(role==='guest'&&!applying){event.preventDefault();event.stopImmediatePropagation();post({kind:'command',route:router.currentRoute.value.fullPath,index:[...document.querySelectorAll('button')].indexOf(button),text:button.textContent?.trim().slice(0,200)??''});return}clearTimeout(timer);timer=window.setTimeout(snapshot,400)},true);
 window.addEventListener('message',async event=>{
  if(event.source!==parent||event.origin!==location.origin||event.data?.channel!=='lovehouse-taoyuan')return;
  if(event.data.type==='role'){role=event.data.role;snapshot();return}
  const data=event.data.payload;if(event.data.type!=='receive'||!data)return;
  if(role==='guest'&&data.kind==='state'&&typeof data.save==='string'&&data.save.length<2_000_000){applying=true;try{const store=useSaveStore();if(store.importSave(0,data.save)&&store.loadFromSlot(0))await router.replace(data.route.startsWith('/game')?data.route:'/game/farm')}finally{applying=false}}
  if(role==='host'&&data.kind==='command'&&data.route===router.currentRoute.value.fullPath&&Number.isInteger(data.index)){const button=document.querySelectorAll('button')[data.index];if(button&&!button.disabled&&button.textContent?.trim().slice(0,200)===data.text)button.click()}
 });
 window.setInterval(snapshot,3000);parent.postMessage({channel:'lovehouse-taoyuan',type:'ready'},location.origin);
}
