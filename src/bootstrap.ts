let failed=false;
function pixelProgress(value:number){const progress=Math.max(0,Math.min(100,Math.round(value*100))),bar=document.getElementById('boot-progress');bar?.setAttribute('aria-valuenow',String(progress));bar?.querySelectorAll('b').forEach((cell,index)=>cell.classList.toggle('lit',index<Math.floor(progress/5)));const label=document.getElementById('boot-percent');if(label)label.textContent=progress+' / 100';const title=document.getElementById('boot-text');if(title)title.textContent=progress<15?'正在找到回家的路…':progress<75?'正在摆好礼物和软垫…':'正在点灯，等你推门…'}
document.addEventListener('cottage-load-progress',event=>pixelProgress((event as CustomEvent<number>).detail??0));

const showFailure=()=>{if(failed||document.body.dataset.gameReady==='true')return;failed=true;const status=document.getElementById('load-status');if(status)status.textContent='画面没有准备好';const enter=document.getElementById('retry-load') as HTMLButtonElement|null;if(enter){enter.classList.remove('hidden');enter.disabled=false;enter.textContent='重新点亮小屋';enter.onclick=()=>location.reload()}const note=document.getElementById('entry-note');if(note)note.textContent='小屋没有顺利打开，轻点重试。';document.body.dataset.bootState='error'};
window.addEventListener('error',showFailure);
window.addEventListener('unhandledrejection',showFailure);
let timeout=window.setTimeout(showFailure,45000);
document.addEventListener('cottage-load-progress',()=>{clearTimeout(timeout);timeout=window.setTimeout(showFailure,45000)});
document.addEventListener('cottage-ready',()=>{clearTimeout(timeout);pixelProgress(1);document.body.dataset.gameReady='true';document.body.dataset.bootState='ready'});
void import('./main').catch(showFailure);
