import {drawClimateView} from './climate-art';
import {isSeatItem} from './item-category';
import {uiCopy,formatCopy,wardrobeOptionIds,settingsTabCopyIds} from '../content/ui-copy';
import {installRoundMinimap} from './round-minimap';
import {renderCalendarPanel,updateCalendarPanel} from './calendar-ui';
import {calendarSnapshot,clockLabel,weekdayName,seasonNames,weatherNames,periodNames,type CalendarSnapshot} from './calendar';
import type {Cottage} from './scene';
import {save,persist,grantItem,placeItem,importSave,isSnack,type Snack} from './state';
import {worlds,routeBetween,type Zone,type Item} from './world';
import {birthdayConfig as config} from '../content/birthday-config';
import {assetUrl,textureFiles} from './assets';
import {music} from './audio';
export type UIContext={scene:Cottage;open:(html:string,kind?:string)=>void;close:()=>void;toast:(s:string)=>void;travel:(zone:Zone)=>void;enter:()=>void;photo:()=>void;act:(kind:string)=>void;showGift:(id:string)=>void;shareSnack:(id:Snack)=>void;canUse?:()=>boolean};
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));const $=(id:string)=>document.getElementById(id)!;
export const itemNames:Record<string,string>={marshmallow:uiCopy('bag.marshmallow'),'quiz-star':uiCopy('quiz.prize-star'),'quiz-heart':uiCopy('quiz.prize-heart'),'quiz-ribbon':uiCopy('quiz.prize-ribbon'),flower:'一朵花',shell:'小海螺',postcard:'明信片',doll:'红发小娃娃',lantern:'营灯',crystal:'魔法晶石',ribbon:'幽灵丝带',ticket:'电影票根',token:'乘车纪念章',film:'回忆胶片','mars-stone':'火星小石头',...Object.fromEntries(config.gifts.map(g=>[g.id,g.name]))};
export function installUI(ctx:UIContext){const {scene,open,close,toast}=ctx;let unlocked=false;let minimap:ReturnType<typeof installRoundMinimap>|undefined;const on=(id:string,fn:()=>void)=>{const e=document.getElementById(id);if(e)e.onclick=()=>{if(ctx.canUse&&!ctx.canUse())return;fn()}};
 const button=(label:string,id:string,cls='secondary')=>`<button class="${cls}" id="${id}">${esc(label)}</button>`;
 const thumbnail=(key:string,size=40)=>{if(!scene.textures.exists(key))return '';const source=scene.textures.get(key).getSourceImage() as HTMLCanvasElement,c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d')!;g.imageSmoothingEnabled=false;const r=Math.min(size/source.width,size/source.height);g.drawImage(source,(size-source.width*r)/2,(size-source.height*r)/2,source.width*r,source.height*r);return c.toDataURL('image/png')};
 const icons:Record<string,string>={music:'music','ceremony-music':'music',journal:'journal',photo:'photo',fullscreen:'fullscreen',settings:'settings','map-toggle':'map','companion-toggle':'companion','sky-settings':'sky',bag:'bag','online-toggle':'letter','tools-toggle':'portrait'};
 function refresh(){minimap?.refresh();document.body.classList.toggle('large-text',save.settings.text==='large');document.body.classList.toggle('low-quality',save.settings.quality==='low');for(const [id,key]of Object.entries(icons)){const e=document.getElementById(id);if(!e||!scene.textures.exists('ui-'+key))continue;const source=scene.textures.get('ui-'+key).getSourceImage() as HTMLCanvasElement;const img=document.createElement('img');img.alt='';img.className='pixel-icon';img.src=thumbnail('ui-'+key,24);const label=e.getAttribute('aria-label')||e.title||e.textContent||key;e.replaceChildren(img);e.setAttribute('aria-label',label);e.title=label}const badge=$('progress').querySelector('span');if(badge){const image=document.createElement('img');image.className='pixel-icon';image.alt='';image.src=thumbnail('ui-bag',24);badge.replaceChildren(image)}paintClimate(scene.calendarState);scene.refresh()}
 function toolbar(){const tools=document.querySelector('.hud-tools')!;for(const id of ['map-toggle','companion-toggle','sky-settings'])tools.append($(id));document.querySelector('.explore-tools')?.remove();on('tools-toggle',()=>{tools.classList.toggle('expanded');$('tools-toggle').setAttribute('aria-expanded',String(tools.classList.contains('expanded')))});on('bag',()=>bag());on('settings',()=>settings());on('map-toggle',()=>worldMap());on('companion-toggle',()=>companion());on('sky-settings',()=>sky());refresh()}
 function companion(){open(`<h2 id="modal-title">${esc(uiCopy('companion.title'))}</h2><p>${esc(uiCopy('companion.help'))}</p><div class="menu-grid">${[['hand',scene.holding?uiCopy('companion.release'):uiCopy('companion.hand')],['hug',uiCopy('companion.hug')],['shoulder',uiCopy('companion.shoulder')],['head',uiCopy('companion.head')],['flower',uiCopy('companion.flower')],['share',uiCopy('companion.share')],['dance',uiCopy('companion.dance')],['scare',uiCopy('companion.scare')]].map(([id,title])=>button(title,'aff-'+id)).join('')}</div><div class="modal-actions">${button(save.following?uiCopy('companion.wait'):uiCopy('companion.follow'),'follow-toggle')}</div>`,'companion');for(const kind of ['hand','hug','shoulder','head','flower','share','dance','scare'])on('aff-'+kind,()=>{close();ctx.act(kind)});on('follow-toggle',()=>{scene.setFollowing(!save.following);close()})}
 function avatar(who:'girl'|'boy'){const src=scene.avatar(who);return `<img class="avatar-preview" id="preview-${who}" src="${src}" alt="${who==='girl'?'女主':'男主'}当前形象">`}
 function customize(first=false){open(`<div class="subheading">${esc(uiCopy('wardrobe.eyebrow'))}</div><h2 id="modal-title">${esc(uiCopy('wardrobe.title'))}</h2><div class="customize-grid">${(['girl','boy'] as const).map(who=>`<section>${avatar(who)}<label>${esc(who==='girl'?uiCopy('wardrobe.girl-name'):uiCopy('wardrobe.boy-name'))}<input id="name-${who}" maxlength="24" value="${esc(save.names[who])}"></label>${[['hair',uiCopy('wardrobe.hair'),4],['color',uiCopy('wardrobe.color'),6],['skin',uiCopy('wardrobe.skin'),4],['outfit',uiCopy('wardrobe.outfit'),3]].map(([key,title,count])=>`<label>${esc(String(title))}<select id="${who}-${key}">${Array.from({length:count as number},(_,i)=>`<option value="${i}" ${save.appearance[who][key as 'hair']===i?'selected':''}>${esc(uiCopy(wardrobeOptionIds[key as keyof typeof wardrobeOptionIds][i]))}</option>`).join('')}</select></label>`).join('')}</section>`).join('')}</div><div class="modal-actions">${button(first?uiCopy('wardrobe.enter'):uiCopy('wardrobe.save'),'custom-save','primary')}</div><small>${esc(uiCopy('wardrobe.help'))}</small>`,'customize');for(const who of ['girl','boy'] as const)for(const key of ['hair','color','skin','outfit'] as const){const input=$(who+'-'+key) as HTMLSelectElement;input.onchange=()=>{save.appearance[who][key]=Number(input.value);scene.refreshAppearance();($('preview-'+who) as HTMLImageElement).src=scene.avatar(who)}}on('custom-save',()=>{for(const who of ['girl','boy'] as const)save.names[who]=[...($('name-'+who) as HTMLInputElement).value.trim()].slice(0,12).join('')||(who==='girl'?'你':'我');save.onboarded=true;config.girlName=save.names.girl;config.boyName=save.names.boy;persist();if(first){void music(true);ctx.enter()}close();refresh()})}
 function mapProgress(zone:Zone){
  const keepsakes=new Set(worlds[zone].items.flatMap(item=>item.kind==='collect'&&item.collect?[item.collect]:[]));
  if(zone==='garden')keepsakes.add('shell');
  if(zone==='forest'||zone==='camp')keepsakes.add('lantern');
  if(zone==='postoffice')keepsakes.add('postcard');
  const labels:string[]=[];
  if(zone==='room')labels.push(formatCopy('map.gift-progress',{found:config.gifts.filter(gift=>save.opened.includes(gift.id)).length,total:config.gifts.length}));
  if(keepsakes.size)labels.push(formatCopy('map.keepsake-progress',{found:[...keepsakes].filter(id=>save.inventory.includes(id)).length,total:keepsakes.size}));
  return labels.map(label=>`<small class="map-collection">${esc(label)}</small>`).join('');
 }
 function worldMap(selected?:Zone){
  const z=selected??scene.zone;
  const world=worlds[z];
  const nodes=(Object.keys(worlds) as Zone[]).map(id=>{
   const entry=worlds[id];
   const current=id===scene.zone;
   const visited=save.visited.includes(id);
   const status=current?'map.current':visited?'map.visited':'map.unvisited';
   return `<button class="world-node ${current?'current':''} ${visited?'visited':''}" id="zone-${id}" aria-pressed="${id===z}">
    <img loading="lazy" src="${assetUrl(textureFiles[entry.texture as keyof typeof textureFiles])}" alt="">
    ${current?`<span class="map-avatars"><img src="${scene.avatar('girl')}" alt="${esc(save.names.girl)}"><img src="${scene.avatar('boy')}" alt="${esc(save.names.boy)}"></span>`:''}
    <b>${esc(entry.name)}</b><small>${esc(isSnack(id)?formatCopy('bag.portions',{count:save.snackPortions[id]}):uiCopy(status))}</small>${mapProgress(id)}
   </button>`;
  }).join('');
  const gifts=z==='room'?config.gifts:[];
  const giftList=gifts.map(gift=>`<button id="map-gift-${gift.id}" class="secondary"><span class="item-category">${esc(uiCopy(save.opened.includes(gift.id)?'map.gift-opened':'map.gift-wrapped'))}</span>${esc(gift.name)}</button>`).join('');
  const items=world.items.map(item=>{
   const category=item.to?'exit':item.kind==='collect'?'collect':item.kind==='slot'?'place':isSeatItem(z,item)?'seat':'interact';
   return `<button id="item-${item.id}" class="secondary"><span class="item-category">${esc(uiCopy(`map.category.${category}`))}</span>${esc(item.name)}</button>`;
  }).join('');
  const path=routeBetween(scene.zone,z);
  open(`<div class="subheading">${esc(uiCopy('map.eyebrow'))}</div><h2 id="modal-title">${esc(uiCopy('map.title'))}</h2>
   <div class="world-map">${nodes}</div><h3>${esc(world.name)}</h3><p>${esc(world.caption)}</p>
   <p class="route-label">${esc(formatCopy('map.route-label',{route:path.map(id=>worlds[id].name).join(' → ')}))}</p>
   <div class="modal-actions">${z!==scene.zone?button(save.visited.includes(z)?uiCopy('map.travel'):uiCopy('map.route'),'world-go','primary'):''}</div>
   ${giftList?`<h3>${esc(uiCopy('map.gifts-title'))}</h3><div class="local-items">${giftList}</div>`:''}
   <h3>${esc(uiCopy('map.items-title'))}</h3><div class="local-items">${items}</div>`,'world-map');
  drawConnections();
  for(const id of Object.keys(worlds) as Zone[])on('zone-'+id,()=>worldMap(id));
  on('world-go',()=>{
   close();
   if(save.visited.includes(z)){ctx.travel(z);return}
   const next=path[1];
   if(!next)return;
   const exit=worlds[scene.zone].items.find(item=>item.to===next);
   if(exit){scene.approachById(exit.id);toast(formatCopy('map.route-next',{name:worlds[next].name}))}
  });
  const approach=(id:string)=>{
   if(z!==scene.zone){toast(uiCopy('map.remote-hint'));return}
   close();scene.approachById(id);
  };
  for(const gift of gifts)on('map-gift-'+gift.id,()=>approach(gift.id));
  for(const item of world.items)on('item-'+item.id,()=>approach(item.id));
 }
 function drawConnections(){const map=document.querySelector<HTMLElement>('.world-map');if(!map)return;const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('map-links');map.prepend(svg);const r=map.getBoundingClientRect();svg.setAttribute('viewBox',`0 0 ${r.width} ${r.height}`);const seen=new Set<string>();for(const [zone,w]of Object.entries(worlds))for(const item of w.items){if(!item.to)continue;const key=[zone,item.to].sort().join(':');if(seen.has(key))continue;seen.add(key);const a=$('zone-'+zone).getBoundingClientRect(),b=$('zone-'+item.to).getBoundingClientRect(),line=document.createElementNS('http://www.w3.org/2000/svg','line');for(const [k,v]of Object.entries({x1:a.x+a.width/2-r.x,y1:a.y+a.height/2-r.y,x2:b.x+b.width/2-r.x,y2:b.y+b.height/2-r.y}))line.setAttribute(k,String(v));svg.append(line)}}
 const gearSlots=['hat','earphones','band'] as const;
 const bagCategories=['all','keepsake','snack','gear'] as const;
 type BagCategory=(typeof bagCategories)[number];
 function bag(slot?:Item,category:BagCategory='all'){
  const allowed=['flower','shell','postcard','doll','lantern'];
  const gear=gearSlots.filter(id=>save.inventory.includes(id));
  const categoryOf=(id:string):BagCategory=>gear.some(piece=>piece===id)?'gear':isSnack(id)?'snack':'keepsake';
  const items=save.inventory.filter(id=>category==='all'||categoryOf(id)===category);
  const tabs=bagCategories.map(id=>`<button id="bag-filter-${id}" class="${id===category?'primary':'secondary'}" aria-pressed="${id===category}">${esc(uiCopy(`bag.category.${id}`))}</button>`).join('');
  const slots=items.map(id=>{
   const worn=gear.find(piece=>piece===id);
   const texture=scene.textures.exists('gift-'+id)?'gift-'+id:id==='shell'?'prop-5':id==='lantern'?'prop-0':id==='marshmallow'?'gift-chestnuts':'ui-letter';
   const status=Object.values(save.placements).includes(id)?'bag.placed':worn&&save[worn]?'bag.equipped':'bag.collected';
   return `<button class="bag-item" id="bag-${id}"><img class="bag-art" src="${thumbnail(texture)}" alt=""><b>${esc(itemNames[id]??id)}</b><small>${esc(uiCopy(status))}</small></button>`;
  }).join('');
  const emptySlots=category==='all'?'<div class="empty-slot" aria-hidden="true"></div>'.repeat(Math.max(0,32-items.length)):'';
  open(`<div class="subheading">${esc(uiCopy('bag.eyebrow'))}</div><h2 id="modal-title">${esc(uiCopy(slot?'bag.place-title':'bag.title'))}</h2>
   <p>${esc(uiCopy(slot?'bag.place-help':'bag.help'))}</p>
   <div class="bag-filters">${tabs}</div>
   ${!items.length&&category!=='all'?`<p>${esc(uiCopy('bag.empty-category'))}</p>`:''}
   <div class="bag-grid">${slots}${emptySlots}</div>
   <div class="modal-actions">${slot&&save.placements[scene.zone+':'+slot.id]?button(uiCopy('bag.retrieve'),'take-back'):''}</div>`,'bag');
  for(const id of bagCategories)on('bag-filter-'+id,()=>bag(slot,id));
  for(const id of items)on('bag-'+id,()=>{
   if(slot){
    if(!allowed.includes(id)){toast(uiCopy('bag.incompatible'));return}
    if(placeItem(scene.zone+':'+slot.id,id)){scene.refresh();close()}
    return;
   }
   const wearable=gear.find(piece=>piece===id);
   if(wearable){save[wearable]=!save[wearable];persist();scene.refresh();bag(undefined,category);return}
   if(id==='marshmallow'){ctx.shareSnack(id);return}
   if(config.gifts.some(gift=>gift.id===id)){ctx.showGift(id);return}
   toast(uiCopy('bag.place-hint'));
  });
  on('take-back',()=>{if(!slot)return;delete save.placements[scene.zone+':'+slot.id];persist();scene.refresh();close()});
 }
 function sky(){scene.bridge.emit('retry-climate');if(save.calendar.enabled){open(`<h2 id="modal-title">${esc(uiCopy('sky.calendar-title'))}</h2><div id="calendar-host"></div>`,'calendar');renderCalendarPanel($('calendar-host'),scene,close,toast);return}open(`<h2 id="modal-title">${esc(uiCopy('sky.title'))}</h2><div class="menu-grid">${[['weather',uiCopy('sky.weather'),['clear','rain','snow'],(['clear','rain','snow'] as const).map(v=>weatherNames[v])],['time',uiCopy('sky.period'),['night','dawn','day','dusk'],(['night','dawn','day','dusk'] as const).map(v=>periodNames[v])]].map(([id,title,values,labels])=>`<label>${esc(String(title))}<select id="sky-${id}">${(values as string[]).map((v,i)=>`<option value="${v}">${esc((labels as string[])[i])}</option>`).join('')}</select></label>`).join('')}</div><canvas id="sky-preview" width="360" height="240" role="img" aria-label="${esc(uiCopy('sky.preview'))}" style="display:block;width:min(360px,100%);height:auto;margin:18px auto;image-rendering:pixelated;border:3px solid #a47a53"></canvas><p>${esc(uiCopy('sky.help'))}</p><div class="modal-actions">${button(uiCopy('sky.apply'),'sky-save','primary')}${button(uiCopy('sky.calendar'),'sky-calendar')}</div>`,'sky');($('sky-weather') as HTMLSelectElement).value=save.sky.weather;($('sky-time') as HTMLSelectElement).value=save.sky.time;const preview=()=>{
  const canvas=$('sky-preview') as HTMLCanvasElement,g=canvas.getContext('2d')!;
  const weather=($('sky-weather') as HTMLSelectElement).value,time=($('sky-time') as HTMLSelectElement).value;
  g.clearRect(0,0,canvas.width,canvas.height);
  drawClimateView(g,scene.textures,calendarSnapshot({...save.calendar,enabled:false},{weather,time}),{x:0,y:0,w:canvas.width,h:canvas.height});
 };preview();($('sky-weather') as HTMLSelectElement).onchange=preview;($('sky-time') as HTMLSelectElement).onchange=preview;on('sky-calendar',()=>settings('时间'));on('sky-save',()=>{save.sky.weather=($('sky-weather') as HTMLSelectElement).value;save.sky.time=($('sky-time') as HTMLSelectElement).value;scene.weather=save.sky.weather;scene.daylight=save.sky.time;persist();scene.refreshEnvironment();close()})}
 function settings(tab='声音'){const tabs=['声音','时间','画面','操作','角色','进度','关于'];open(`<h2 id="modal-title">${esc(uiCopy('settings.title'))}</h2><nav class="settings-tabs">${tabs.map((t,i)=>button(uiCopy(settingsTabCopyIds[i]),'tab-'+t,t===tab?'primary':'secondary')).join('')}</nav><div id="settings-body"></div>`,'settings');for(const t of tabs)on('tab-'+t,()=>settings(t));const body=$('settings-body');if(tab==='声音'){body.innerHTML=`${button(save.music?uiCopy('settings.music-on'):uiCopy('settings.music-off'),'set-music')}${(['musicVolume','sfxVolume','ambientVolume'] as const).map((k,i)=>`<label>${[uiCopy('settings.music-volume'),uiCopy('settings.sfx-volume'),uiCopy('settings.ambient-volume')][i]}<input id="volume-${k}" type="range" min="0" max="1" step="0.05" value="${save.settings[k]}"></label>`).join('')}`;on('set-music',()=>{save.music=!save.music;persist();void music(true);settings(tab)});for(const k of ['musicVolume','sfxVolume','ambientVolume'] as const)($('volume-'+k) as HTMLInputElement).oninput=()=>{save.settings[k]=Number(($('volume-'+k) as HTMLInputElement).value);persist();void music(true)}}
 else if(tab==='时间'){renderCalendarPanel(body,scene,close,toast)}
 else if(tab==='画面'){body.innerHTML=button(save.settings.minimap?uiCopy('settings.minimap-on'):uiCopy('settings.minimap-off'),'set-minimap')+button(save.reduced?uiCopy('settings.motion-on'):uiCopy('settings.motion-off'),'set-motion')+button(save.settings.text==='large'?uiCopy('settings.text-large'):uiCopy('settings.text-normal'),'set-text')+button(save.settings.quality==='low'?uiCopy('settings.quality-low'):uiCopy('settings.quality-high'),'set-quality');on('set-minimap',()=>{save.settings.minimap=!save.settings.minimap;persist();minimap?.refresh();settings(tab)});on('set-motion',()=>{save.reduced=!save.reduced;document.body.classList.toggle('reduced-motion',save.reduced);persist();settings(tab)});on('set-text',()=>{save.settings.text=save.settings.text==='large'?'normal':'large';persist();refresh();settings(tab)});on('set-quality',()=>{save.settings.quality=save.settings.quality==='low'?'high':'low';persist();refresh();settings(tab)})}
 else if(tab==='操作'){body.innerHTML=button(save.settings.directions?uiCopy('settings.directions-on'):uiCopy('settings.directions-off'),'set-directions')+`<p>${esc(uiCopy('settings.controls-help'))}</p>`+button(save.settings.haptics?uiCopy('settings.haptics-on'):uiCopy('settings.haptics-off'),'set-haptics')+`<p>${esc(uiCopy('settings.fullscreen-help'))}</p>`;on('set-directions',()=>{save.settings.directions=!save.settings.directions;persist();$('world-signs').hidden=!save.settings.directions;settings(tab)});on('set-haptics',()=>{save.settings.haptics=!save.settings.haptics;persist();settings(tab)})}
 else if(tab==='角色'){body.innerHTML=button(uiCopy('settings.customize'),'set-custom');on('set-custom',()=>customize())}
 else if(tab==='进度'){body.innerHTML=button(uiCopy('settings.export'),'save-export')+`<label>${esc(uiCopy('settings.import'))}<input id="save-import" type="file" accept="application/json"></label>`+button(uiCopy('settings.reset'),'save-reset');on('save-export',()=>{const data=JSON.stringify(save,null,2),nativeSave=(window as Window&{CottageSave?:{postMessage:(data:string)=>void}}).CottageSave;if(nativeSave){nativeSave.postMessage(data);return}const blob=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='生日小屋存档.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});($('save-import') as HTMLInputElement).onchange=async()=>{const file=($('save-import') as HTMLInputElement).files?.[0];if(!file)return;try{importSave(await file.text());location.reload()}catch{toast(uiCopy('settings.import-error'))}};on('save-reset',()=>{open(`<h2 id="modal-title">${esc(uiCopy('settings.reset-title'))}</h2><p>${esc(uiCopy('settings.reset-help'))}</p><div class="modal-actions">${button(uiCopy('settings.keep'),'reset-no')}${button(uiCopy('settings.confirm-reset'),'reset-yes','primary')}</div>`,'reset');on('reset-no',()=>settings('进度'));on('reset-yes',()=>{localStorage.removeItem('birthday-cottage-v2');localStorage.removeItem('birthday-cottage-v1');for(const k of ['birthday-future','birthday-postcard','birthday-aquarium-note','birthday-sky'])localStorage.removeItem(k);location.reload()})})}
 else body.innerHTML=['settings.about.title','settings.about.music','settings.about.font','settings.about.storage'].map(id=>`<p>${esc(uiCopy(id as 'settings.about.title'))}</p>`).join('')}
 async function begin(){document.body.classList.toggle('android-client',Boolean((window as Window&{CottageSave?:unknown}).CottageSave));await document.fonts.load('24px CottagePixel');minimap??=installRoundMinimap(scene,()=>worldMap());toolbar();scene.refreshEnvironment();config.girlName=save.names.girl;config.boyName=save.names.boy;$('boot-cover')?.remove();$('opening').classList.add('hidden');if(save.onboarded){open(`<div class="subheading">${esc(uiCopy('entry.eyebrow'))}</div><h2 id="modal-title">${esc(uiCopy('entry.title'))}</h2><div class="modal-actions">${button(uiCopy('entry.continue'),'continue','primary')}${button(uiCopy('entry.customize'),'re-custom')}</div>`,'entry');on('continue',()=>{void music(true);ctx.enter();close()});on('re-custom',()=>customize(true))}else customize(true);unlocked=true}
 function paintClimate(s:CalendarSnapshot){
  if(!scene.textures.exists('time-night'))return;const period=s.period==='dusk'?'dawn':s.period;
  const sky=$('sky-settings'),icon=sky.querySelector<HTMLImageElement>('.pixel-icon');if(icon)icon.src=thumbnail('weather-'+s.weather,24);
  let mini=sky.querySelector<HTMLImageElement>('.sky-time-mini');if(!mini){mini=document.createElement('img');mini.className='sky-time-mini';mini.alt='';sky.append(mini)}mini.src=thumbnail('time-'+period,12);
  const label=formatCopy('sky.status',{weather:weatherNames[s.weather],period:periodNames[s.period]})+(s.enabled?` · ${s.temperature.toFixed(1)}°C`:'');sky.title=label;sky.setAttribute('aria-label',label);
  const emblem=document.querySelector('.place-plaque>span');if(emblem){let image=emblem.querySelector('img');if(!image){image=document.createElement('img');image.alt='';image.className='place-time-icon';emblem.replaceChildren(image)}image.src=thumbnail('time-'+period,24)}
  let badge=document.getElementById('calendar-hud');if(!badge){badge=document.createElement('small');badge.id='calendar-hud';document.querySelector('.place-plaque>div')?.append(badge)}badge.classList.toggle('hidden',!s.enabled);if(s.enabled)badge.innerHTML=`<span>${s.date.replaceAll('-','.')} 周${esc(weekdayName(s.weekday))} ${clockLabel(s.minutes)}</span><span>${esc(seasonNames[s.season])} · ${esc(weatherNames[s.weather])} · ${s.temperature.toFixed(1)}°C</span>`;
  $('location-caption').classList.toggle('hidden',s.enabled);document.body.classList.toggle('calendar-on',s.enabled);
 }
 scene.bridge.on('climate-asset-error',()=>toast(uiCopy('climate.load-error')));
 scene.bridge.on('calendar',(s:CalendarSnapshot)=>{paintClimate(s);updateCalendarPanel(s)});
 return {begin,customize,settings,worldMap,bag,refresh,collect(item:Item){if(!item.collect)return;grantItem(item.collect);scene.remember(item.id);toast(formatCopy('bag.collect-toast',{name:itemNames[item.collect]??item.collect}));scene.refresh()},ready:()=>unlocked};
}
