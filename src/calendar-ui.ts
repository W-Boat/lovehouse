import type {Cottage} from './scene';
import {save,persist} from './state';
import {calendarSnapshot,clockLabel,enableCalendar,validCalendarDate,seasonNames,weatherNames,periodNames,type CalendarSnapshot} from './calendar';
import {drawClimateView} from './climate-art';
let active:{host:HTMLElement;scene:Cottage;month:string;gridKey:string;followMonth:boolean;pending?:boolean}|undefined;
const labels={auto:'自动',manual:'手动'};
const options=(values:string[],names:string[],selected:string)=>values.map((v,i)=>`<option value="${v}" ${v===selected?'selected':''}>${names[i]}</option>`).join('');
export function renderCalendarPanel(host:HTMLElement,scene:Cottage,done:()=>void,toast:(text:string)=>void){
 const c=save.calendar;active={host,scene,month:c.date.slice(0,7),gridKey:'',followMonth:true};
 const mode=(id:string,value:string)=>`<select id="calendar-${id}">${options(['auto','manual'],Object.values(labels),value)}</select>`;
 host.innerHTML=`<label class="calendar-switch"><input id="calendar-enabled" type="checkbox" ${c.enabled?'checked':''}>开启小屋日历</label><p class="calendar-help">第一次开启从 2026.10.23 开始。自动时间只在小屋运行且页面可见时推进。</p><output id="calendar-summary" class="calendar-summary"></output><fieldset id="calendar-fields" ${c.enabled?'':'disabled'}><div class="calendar-panel"><section><nav class="calendar-month-nav"><button id="calendar-prev" aria-label="上一个月">‹</button><b id="calendar-month"></b><button id="calendar-next" aria-label="下一个月">›</button></nav><div class="calendar-weekdays">${['一','二','三','四','五','六','日'].map(d=>`<span>${d}</span>`).join('')}</div><div id="calendar-grid" class="calendar-grid"></div><label>日期<input id="calendar-date" type="date" min="1900-01-01" max="9998-12-31" value="${c.date}"></label><label>时刻<input id="calendar-time" type="time" value="${clockLabel(c.minutes)}"></label></section><section class="calendar-controls"><label>时间如何变化${mode('time-mode',c.timeMode)}</label><label>时间流速<select id="calendar-speed">${options(['1','10','30','60'],['和现实一样快','1 分钟走过 10 分钟','1 分钟走过半小时','1 分钟走过 1 小时'],String(c.timeScale))}</select></label><label>四季${mode('season-mode',c.seasonMode)}</label><select id="calendar-season" aria-label="手动季节">${options(Object.keys(seasonNames),Object.values(seasonNames),c.season)}</select><label>天气${mode('weather-mode',c.weatherMode)}</label><select id="calendar-weather" aria-label="手动天气">${options(Object.keys(weatherNames),Object.values(weatherNames),c.weather)}</select><label>气温${mode('temperature-mode',c.temperatureMode)}</label><label class="temperature-value"><input id="calendar-temperature" aria-label="手动气温" type="number" min="-30" max="45" step="0.1" value="${c.temperature}"> °C</label><p class="calendar-help">自动四季跟随月份，天气与气温按小屋气候变化。特色场景保留各自氛围。</p></section></div></fieldset><canvas id="calendar-preview" width="360" height="240" role="img" aria-label="日历所选季节和天空预览"></canvas><div class="modal-actions calendar-done"><button id="calendar-done" class="primary">就这样，去感受一下</button></div>`;
 const get=<T extends HTMLElement=HTMLElement>(id:string)=>host.querySelector<T>('#calendar-'+id)!;
 const apply=()=>{persist();scene.refreshEnvironment();updateCalendarPanel(scene.calendarState)};
 get<HTMLInputElement>('enabled').onchange=async()=>{
  const checkbox=get<HTMLInputElement>('enabled'),enabled=checkbox.checked;checkbox.disabled=true;const panel=active;if(panel)panel.pending=true;updateCalendarPanel(scene.calendarState);
  try{if(enabled)await scene.prepareCalendar();enableCalendar(c,enabled);if(active){active.month=c.date.slice(0,7);active.followMonth=true}apply()}
  catch{checkbox.checked=c.enabled;toast('四季窗景还没准备好，稍后再试一次。')}
  finally{checkbox.disabled=false;if(active===panel&&active)active.pending=false;updateCalendarPanel(scene.calendarState)}
 };
 get<HTMLInputElement>('date').onchange=()=>{const input=get<HTMLInputElement>('date');if(!validCalendarDate(input.value)){input.value=c.date;toast('这个日期没有读懂，请重新选一天。');return}c.date=input.value;if(active){active.month=c.date.slice(0,7);active.followMonth=true}apply()};
 get<HTMLInputElement>('time').onchange=()=>{const value=get<HTMLInputElement>('time').value;if(!/^\d{2}:\d{2}$/.test(value))return;const[h,m]=value.split(':').map(Number);if(h<24&&m<60){c.minutes=h*60+m;apply()}};
 get<HTMLSelectElement>('time-mode').onchange=()=>{c.timeMode=get<HTMLSelectElement>('time-mode').value as 'auto'|'manual';apply()};
 get<HTMLSelectElement>('speed').onchange=()=>{c.timeScale=Number(get<HTMLSelectElement>('speed').value) as typeof c.timeScale;apply()};
 for(const key of ['season','weather','temperature'] as const){
  get<HTMLSelectElement>(key+'-mode').onchange=()=>{const snap=calendarSnapshot(c,save.sky);c[key+'Mode' as 'seasonMode']=get<HTMLSelectElement>(key+'-mode').value as 'auto'|'manual';if(key==='season')c.season=snap.season;else if(key==='weather')c.weather=snap.weather;else c.temperature=snap.temperature;apply()};
 }
 get<HTMLSelectElement>('season').onchange=()=>{c.season=get<HTMLSelectElement>('season').value as typeof c.season;apply()};
 get<HTMLSelectElement>('weather').onchange=()=>{c.weather=get<HTMLSelectElement>('weather').value as typeof c.weather;apply()};
 get<HTMLInputElement>('temperature').onchange=()=>{const input=get<HTMLInputElement>('temperature'),n=Number(input.value);if(Number.isFinite(n)){c.temperature=Math.max(-30,Math.min(45,n));apply()}else input.value=String(c.temperature)};
 const browse=(delta:number)=>{if(!active)return;const [y,m]=active.month.split('-').map(Number),date=new Date(Date.UTC(y,m-1+delta,1));if(date.getUTCFullYear()<1900||date.getUTCFullYear()>9998)return;active.month=date.toISOString().slice(0,7);active.followMonth=false;updateCalendarPanel(scene.calendarState)};
 get<HTMLButtonElement>('prev').onclick=()=>browse(-1);get<HTMLButtonElement>('next').onclick=()=>browse(1);get<HTMLButtonElement>('done').onclick=done;
 updateCalendarPanel(scene.calendarState);
}
export function updateCalendarPanel(s:CalendarSnapshot){
 if(!active)return;const{host,scene}=active;if(!host.isConnected||!host.querySelector('#calendar-enabled')){active=undefined;return}
 const get=<T extends HTMLElement=HTMLElement>(id:string)=>host.querySelector<T>('#calendar-'+id)!,c=save.calendar;
 if(!active.pending)get<HTMLInputElement>('enabled').checked=c.enabled;get<HTMLFieldSetElement>('fields').disabled=!c.enabled;
 get('summary').textContent=active.pending?'正在准备四季窗景…':c.enabled?`${s.date.replaceAll('-','.')}　星期${['日','一','二','三','四','五','六'][s.weekday]}　${clockLabel(s.minutes)}　${seasonNames[s.season]} · ${weatherNames[s.weather]} · ${s.temperature.toFixed(1)}°C`:'日历已关闭。手动天空仍可从天气面板调整。';
 const fill=(id:string,value:string)=>{const input=get<HTMLInputElement>(id);if(document.activeElement!==input)input.value=value};
 fill('date',c.date);fill('time',clockLabel(c.minutes));fill('time-mode',c.timeMode);fill('speed',String(c.timeScale));get<HTMLSelectElement>('speed').disabled=c.timeMode==='manual';
 for(const key of ['season','weather','temperature'] as const){fill(key+'-mode',c[key+'Mode' as 'seasonMode']);const input=get<HTMLInputElement>(key);input.disabled=c[key+'Mode' as 'seasonMode']==='auto';if(document.activeElement!==input)input.value=String(c[key+'Mode' as 'seasonMode']==='auto'?s[key]:c[key])}
 if(active.followMonth)active.month=c.date.slice(0,7);const key=active.month+':'+c.date;
 if(key!==active.gridKey){active.gridKey=key;const[y,m]=active.month.split('-').map(Number),first=(new Date(Date.UTC(y,m-1,1)).getUTCDay()+6)%7,count=new Date(Date.UTC(y,m,0)).getUTCDate(),grid=get('grid');get('month').textContent=`${y} 年 ${m} 月`;grid.replaceChildren();for(let i=0;i<first;i++){const blank=document.createElement('span');grid.append(blank)}for(let d=1;d<=count;d++){const date=active.month+'-'+String(d).padStart(2,'0'),button=document.createElement('button');button.type='button';button.textContent=String(d);button.dataset.date=date;button.className=date===c.date?'selected':'';button.setAttribute('aria-label',date);button.setAttribute('aria-pressed',String(date===c.date));button.onclick=()=>{c.date=date;persist();scene.refreshEnvironment()};grid.append(button)}}
 const canvas=get<HTMLCanvasElement>('preview'),g=canvas.getContext('2d')!;g.clearRect(0,0,360,240);drawClimateView(g,scene.textures,s,{x:0,y:0,w:360,h:240});
 get('preview').setAttribute('aria-label',`${seasonNames[s.season]}、${weatherNames[s.weather]}、${periodNames[s.period]}的窗景预览`);
}
