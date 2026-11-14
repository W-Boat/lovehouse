let failed=false;
function pixelProgress(value:number){if(failed)return;const progress=Math.max(0,Math.min(100,Math.round(value*100))),bar=document.getElementById('boot-progress');bar?.setAttribute('aria-valuenow',String(progress));bar?.querySelectorAll('b').forEach((cell,index)=>cell.classList.toggle('lit',index<Math.floor(progress/5)));const label=document.getElementById('boot-percent');if(label)label.textContent=progress+' / 100';const title=document.getElementById('boot-text');if(title)title.textContent=progress<15?'正在找到回家的路…':progress<75?'正在摆好礼物和软垫…':'正在点灯，等你推门…'}
let cloudShare=0;
document.addEventListener('cottage-load-progress',event=>{document.body.dataset.cloudCoreLoading='true';pixelProgress(cloudShare+(1-cloudShare)*((event as CustomEvent<number>).detail??0))});
document.addEventListener('cottage-cloud-progress',event=>{
 const {done,total,failed}=(event as CustomEvent<{done:number;total:number;failed:number}>).detail;
 if(!document.body.dataset.gameReady&&cloudShare===0)cloudShare=.15;
 if(!document.body.dataset.gameReady&&!document.body.dataset.cloudCoreLoading){
  pixelProgress(cloudShare*done/total);
  const label=document.getElementById('boot-text');
  if(label)label.textContent='正在同步资源 '+done+' / '+total;
 }
 const app=document.getElementById('app');
 let status=document.getElementById('release-download-status');
 if(!app)return;
 if(done===total&&!failed){status?.remove();return}
 if(!status){
  status=document.createElement('aside');status.id='release-download-status';
  status.innerHTML='<span role="status"></span><progress aria-label="资源下载进度"></progress>';
  app.append(status);
 }
 status.querySelector('span')!.textContent='资源 '+done+' / '+total+(failed?' · '+failed+' 项未下载':'');
 const meter=status.querySelector('progress')!;meter.max=total;meter.value=done;
 if(done===total)window.setTimeout(()=>status?.remove(),5000);
});

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
void import('./opening-gate').then(async ({waitForOpening})=>{
 clearTimeout(timeout);
 await waitForOpening();
 timeout=window.setTimeout(showFailure,45000);
 await import('./cloud-content').then(module=>module.syncCloudContent()).catch(()=>{});
 await import('./main');
}).catch(showFailure);
