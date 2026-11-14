export function showFrameLoading(frame:HTMLIFrameElement,parent:HTMLElement,text:string){
 const status=document.createElement('div');
 status.className='frame-loading';
 const label=document.createElement('span');
 label.setAttribute('role','status');label.textContent=text;
 const progress=document.createElement('progress');
 progress.setAttribute('aria-label',text);
 status.append(label,progress);parent.insertBefore(status,frame);
 const finish=()=>{clearTimeout(timeout);status.remove()};
 const timeout=window.setTimeout(()=>{
  progress.remove();label.textContent='页面加载较慢。可以继续等待，或关闭后重试。';
 },12000);
 frame.addEventListener('load',finish,{once:true});
}
