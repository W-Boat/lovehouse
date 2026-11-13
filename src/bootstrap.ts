let failed=false;
function pixelProgress(value:number){if(failed)return;const progress=Math.max(0,Math.min(100,Math.round(value*100))),bar=document.getElementById('boot-progress');bar?.setAttribute('aria-valuenow',String(progress));bar?.querySelectorAll('b').forEach((cell,index)=>cell.classList.toggle('lit',index<Math.floor(progress/5)));const label=document.getElementById('boot-percent');if(label)label.textContent=progress+' / 100';const title=document.getElementById('boot-text');if(title)title.textContent=progress<15?'正在找到回家的路…':progress<75?'正在摆好礼物和软垫…':'正在点灯，等你推门…'}
document.addEventListener('cottage-load-progress',event=>pixelProgress((event as CustomEvent<number>).detail??0));

const showFailure=()=>{
 if(failed||document.body.dataset.gameReady==='true')return;
 failed=true;clearTimeout(timeout);document.body.dataset.bootState='error';
 const status=document.getElementById('boot-text');if(status)status.textContent='小屋还没准备好，请检查网络后重试。';
 const label=document.getElementById('boot-percent');if(label)label.textContent='已经准备的灯火，会等你回来。';
 const retry=document.getElementById('boot-retry') as HTMLButtonElement|null;
 if(retry){retry.hidden=false;retry.onclick=()=>location.reload()}
};
window.addEventListener('error',showFailure);
window.addEventListener('unhandledrejection',showFailure);
let timeout=window.setTimeout(showFailure,45000);
document.addEventListener('cottage-load-progress',()=>{clearTimeout(timeout);timeout=window.setTimeout(showFailure,45000)});
document.addEventListener('cottage-ready',()=>{clearTimeout(timeout);pixelProgress(1);document.body.dataset.gameReady='true';document.body.dataset.bootState='ready'});
void import('./cloud-content').then(module=>module.syncCloudContent()).catch(()=>{}).then(()=>import('./main')).catch(showFailure);
