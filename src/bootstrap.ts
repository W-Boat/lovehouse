let failed=false;
const showFailure=()=>{if(failed||document.body.dataset.gameReady==='true')return;failed=true;const status=document.getElementById('load-status');if(status)status.textContent='画面没有准备好';const enter=document.getElementById('retry-load') as HTMLButtonElement|null;if(enter){enter.classList.remove('hidden');enter.disabled=false;enter.textContent='重新点亮小屋';enter.onclick=()=>location.reload()}const note=document.getElementById('entry-note');if(note)note.textContent='小屋没有顺利打开，轻点重试。';document.body.dataset.bootState='error'};
window.addEventListener('error',showFailure);
window.addEventListener('unhandledrejection',showFailure);
let timeout=window.setTimeout(showFailure,45000);
document.addEventListener('cottage-load-progress',()=>{clearTimeout(timeout);timeout=window.setTimeout(showFailure,45000)});
document.addEventListener('cottage-ready',()=>{clearTimeout(timeout);document.body.dataset.gameReady='true';document.body.dataset.bootState='ready'});
void import('./main').catch(showFailure);
