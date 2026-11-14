import './opening-gate.css';

declare const __CONTENT_SERVER__: string;
type OpeningStatus={allowed:boolean;scheduled:boolean;opensAt:number|null;serverTime:number};

export async function waitForOpening(){
 if(typeof __CONTENT_SERVER__!=='string'||!__CONTENT_SERVER__)return;
 const endpoint=new URL('opening',__CONTENT_SERVER__.replace(/\/?$/,'/'));
 const cacheKey='lovehouse-opening:'+endpoint.href;
 let wasClosed=false;
 try{wasClosed=localStorage.getItem(cacheKey)==='closed'}catch{}
 const card=document.querySelector('#boot-cover .boot-card');
 if(!card)return;
 let panel:HTMLElement|undefined,clock:HTMLElement|undefined;
 let deadline:number|undefined;

 function display(){
  if(!card)return;
  if(!panel){
   card.classList.add('opening-wait');
   document.getElementById('boot-cover')?.setAttribute('aria-live','off');
   panel=document.createElement('section');
   panel.className='opening-countdown';
   panel.innerHTML='<h2>小屋尚未开放</h2><div class="opening-sparks" aria-hidden="true"><i></i><i></i><i></i></div><output aria-label="开放倒计时"></output><p>到点后会自动开门</p>';
   clock=panel.querySelector('output')!;
   card.append(panel);
  }
  if(deadline===undefined){clock!.textContent='等待服务器确认';return}
  const seconds=Math.max(0,Math.ceil((deadline-performance.now())/1000));
  const pad=(n:number)=>String(n).padStart(2,'0');
  clock!.textContent=(seconds>=86400?Math.floor(seconds/86400)+' 天 ':'')+
   [Math.floor(seconds/3600)%24,Math.floor(seconds/60)%60,seconds%60].map(pad).join(':');
 }

 if(wasClosed)display();
 let nextCheck=0;
 for(;;){
  if(performance.now()>=nextCheck){
   try{
    const response=await fetch(endpoint,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(2800)});
    if(response.status===404&&!wasClosed)return;
    if(!response.ok)throw Error('Opening status unavailable');
    const status:OpeningStatus=await response.json();
    if(typeof status.allowed!=='boolean'||!Number.isFinite(status.serverTime))throw Error('Invalid opening status');
    if(status.allowed){
     try{localStorage.removeItem(cacheKey)}catch{}
     panel?.remove();card.classList.remove('opening-wait');
     document.getElementById('boot-cover')?.setAttribute('aria-live','polite');
     return;
    }
    if(status.opensAt===null||!Number.isFinite(status.opensAt))throw Error('Invalid opening time');
    wasClosed=true;
    try{localStorage.setItem(cacheKey,'closed')}catch{}
    deadline=performance.now()+Math.max(0,status.opensAt-status.serverTime);
    nextCheck=Math.min(deadline,performance.now()+15000);
   }catch{
    if(!wasClosed)return;
    if(deadline!==undefined&&performance.now()>=deadline)deadline=undefined;
    nextCheck=performance.now()+4000;
   }
  }
  display();
  await new Promise(resolve=>window.setTimeout(resolve,Math.max(100,Math.min(250,nextCheck-performance.now()))));
 }
}

