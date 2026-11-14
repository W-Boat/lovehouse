import {Comment,Fragment,defineComponent,h} from 'vue';
import {NAlert,NDatePicker,NDataTable,NFormItem,NModal,NSelect} from 'naive-ui';

function children(nodes){
 return (nodes??[]).flatMap(node=>node.type===Fragment?children(node.children):node.type===Comment?[]:[node]);
}
export const PublisherOption=defineComponent({props:['label','value'],render:()=>null});
export const PublisherSelect=defineComponent({
 setup(_, {attrs,slots}){
  return ()=>h(NSelect,{...attrs,options:children(slots.default?.()).map(node=>({label:node.props?.label,value:node.props?.value}))});
 },
});
export const PublisherColumn=defineComponent({props:['prop','label','width','minWidth'],render:()=>null});
export const PublisherTable=defineComponent({
 props:['data','emptyText'],
 setup(props,{attrs,slots}){
  return ()=>{
   const columns=children(slots.default?.()).map((node,index)=>{
    const field=node.props??{},render=node.children?.default;
    return {key:field.prop??String(index),title:field.label,width:Number(field.width)||undefined,minWidth:Number(field['min-width'])||undefined,render:render?row=>render({row}):undefined};
   });
   return h(NDataTable,{...attrs,data:props.data,columns},{empty:()=>props.emptyText||'暂无数据'});
  };
 },
});
export const PublisherDialog=defineComponent({
 props:{modelValue:Boolean,title:String,width:String},
 emits:['update:modelValue','close'],
 setup(props,{emit,slots}){
  return ()=>h(NModal,{show:props.modelValue,preset:'card',title:props.title,style:{width:props.width||'min(560px,94vw)'},'onUpdate:show':value=>{
   emit('update:modelValue',value);if(!value)emit('close');
  }},slots);
 },
});
export const PublisherAlert=defineComponent({
 props:['title','description','type'],
 setup(props,{slots}){
  return ()=>h(NAlert,{title:props.title,type:props.type},{default:()=>slots.default?.()??props.description});
 },
});
export const PublisherFormItem=defineComponent({
 props:['label','error'],
 setup(props,{attrs,slots}){
  return ()=>h(NFormItem,{...attrs,label:props.label,validationStatus:props.error?'error':undefined,feedback:props.error},slots);
 },
});
export const PublisherDate=defineComponent({
 props:['modelValue'],emits:['update:modelValue'],
 setup(props,{attrs,emit}){
  return ()=>h(NDatePicker,{...attrs,type:'date',formattedValue:props.modelValue||null,valueFormat:'yyyy-MM-dd',format:'yyyy-MM-dd','onUpdate:formattedValue':value=>emit('update:modelValue',value??'')});
 },
});
