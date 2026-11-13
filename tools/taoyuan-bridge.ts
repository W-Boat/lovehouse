import {useSaveStore} from './src/stores/useSaveStore';
import {useGameStore} from './src/stores/useGameStore';
import router from './src/router';
import {watch} from 'vue';
import {usePlayerStore} from './src/stores/usePlayerStore';
export function installLovehouseBridge(){
 if(window.parent===window)return;
 const query=new URLSearchParams(location.search);
 const identity={name:[...(query.get('lovehouse-name')||'')].slice(0,12).join(''),gender:query.get('lovehouse-gender')==='female'?'female' as const:'male' as const};
 const applyIdentity=()=>{if(identity.name&&useGameStore().isGameStarted)usePlayerStore().setIdentity(identity.name,identity.gender)};
 watch(()=>useGameStore().isGameStarted,applyIdentity,{immediate:true});
 let role='offline',applying=false,timer=0,connected=true;
 type Field=HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement;
 const allowed=new Set(['text','number','checkbox','radio','range','email','url','tel','search','date','time','color','select-one','textarea']);
 const controls=()=>[...document.querySelectorAll<Field>('input,textarea,select')];
 const fields=new Map<number,{route:string;index:number;tag:string;inputType:string;value:string;checked:boolean}>();
 const typeOf=(node:Field)=>node.tagName==='TEXTAREA'?'textarea':node.type;
 const valid=(node:Field)=>allowed.has(typeOf(node))&&!node.disabled&&!(node instanceof HTMLInputElement&&node.readOnly)&&!(node instanceof HTMLTextAreaElement&&node.readOnly);
 const notice=document.createElement('div');notice.textContent='联机中断：桃源乡暂为只读，重连后继续；可通过上方按钮返回小屋。';notice.setAttribute('role','status');notice.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#211e21dc;color:#fff1cf;display:none;align-items:center;justify-content:center;padding:30px;text-align:center';document.body.append(notice);
 const readonly=()=>{notice.style.display=role!=='offline'&&!connected?'flex':'none'};
 document.addEventListener('keydown',e=>{if(role!=='offline'&&!connected){e.preventDefault();e.stopImmediatePropagation()}},true);
 function writeField(data:any,dispatch=false){
  const node=controls()[data.index];if(!node||data.route!==router.currentRoute.value.fullPath||node.tagName!==data.tag||typeOf(node)!==data.inputType||!valid(node)||typeof data.value!=='string'||data.value.length>10000||typeof data.checked!=='boolean')return false;
  if((node instanceof HTMLInputElement||node instanceof HTMLTextAreaElement)&&node.maxLength>=0&&data.value.length>node.maxLength)return false;if(node instanceof HTMLSelectElement&&![...node.options].some(o=>o.value===data.value&&!o.disabled))return false;
  node.value=data.value;if(node instanceof HTMLInputElement)node.checked=data.checked;
  if(dispatch){node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}))}return true;
 }
 for(const eventType of ['input','change'])document.addEventListener(eventType,event=>{
  const node=event.target;if(role!=='guest'||applying||!connected||!(node instanceof HTMLInputElement||node instanceof HTMLTextAreaElement||node instanceof HTMLSelectElement)||!valid(node))return;
  const index=controls().indexOf(node);if(index<0||index>1000)return;
  const data={route:router.currentRoute.value.fullPath,index,tag:node.tagName,inputType:typeOf(node),value:node.value.slice(0,10000),checked:node instanceof HTMLInputElement?node.checked:false};fields.set(index,data);post({kind:'field',...data});
 },true);
 const post=(payload:unknown)=>parent.postMessage({channel:'lovehouse-taoyuan',type:'event',payload},location.origin);
 const snapshot=()=>{
  const route=router.currentRoute.value.fullPath;
  if(role!=='host'||!connected||applying||!route.startsWith('/game/')||!useGameStore().isGameStarted)return;
  const store=useSaveStore(),slot=store.activeSlot;
  if(slot<0||!store.saveToSlot(slot))return;
  const save=localStorage.getItem(`taoyuanxiang_save_${slot}`);
  if(save)post({kind:'state',save,route});
 };
 document.addEventListener('click',event=>{
  if(role!=='offline'&&!connected){event.preventDefault();event.stopImmediatePropagation();return}
  const button=(event.target as Element).closest('button');
  if(!button)return;
  if(role==='guest'){
   // Opening a plot panel changes only local selection. Mirror that selection
   // on the host so the guest can use the resulting controls in both panels.
   const inspectPlot=button.classList.contains('farm-plot');
   if(!inspectPlot){event.preventDefault();event.stopImmediatePropagation()}
   if(applying)return;
   fields.clear();
   post({kind:'command',route:router.currentRoute.value.fullPath,index:[...document.querySelectorAll('button')].indexOf(button),text:button.textContent?.trim().slice(0,200)??''});
   return;
  }
  clearTimeout(timer);timer=window.setTimeout(snapshot,400);
 },true);
 window.addEventListener('message',async event=>{
  if(event.source!==parent||event.origin!==location.origin||event.data?.channel!=='lovehouse-taoyuan')return;
  if(event.data.type==='role'){role=event.data.role;readonly();snapshot();return}
  if(event.data.type==='connection'){connected=event.data.connected===true;readonly();return}
  const data=event.data.payload;if(event.data.type!=='receive'||!data)return;
  if(role==='guest'&&data.kind==='state'&&typeof data.save==='string'&&data.save.length<2_000_000){applying=true;try{const store=useSaveStore();if(store.importSave(0,data.save)&&store.loadFromSlot(0)){applyIdentity();await router.replace(data.route.startsWith('/game')?data.route:'/game/farm')}}finally{await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));for(const [index,field]of fields){if(field.route===router.currentRoute.value.fullPath)writeField(field,true);else fields.delete(index)}applying=false}}
  if(role==='host'&&data.kind==='field'&&Number.isInteger(data.index)&&data.index>=0&&data.index<=1000&&connected){if(writeField(data,true)){clearTimeout(timer);timer=window.setTimeout(snapshot,400)}}
  if(role==='host'&&data.kind==='command'&&connected&&data.route===router.currentRoute.value.fullPath&&Number.isInteger(data.index)){const button=document.querySelectorAll('button')[data.index];if(button&&!button.disabled&&button.textContent?.trim().slice(0,200)===data.text)button.click()}
 });
 window.setInterval(snapshot,3000);parent.postMessage({channel:'lovehouse-taoyuan',type:'ready'},location.origin);
}
