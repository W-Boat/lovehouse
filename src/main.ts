import {validDpi,stickVector} from './display';
import {installRewards} from './rewards';
import {seatDefinition} from './layouts';
import {openHeartbeat,openSugarWorkshop} from './side-games';
import {hintPosition} from './interaction-targets';
import {mainText,mainHtml} from '../content/main-copy';
import type {TaoyuanField} from './online-protocol';
import {installOnlineAffection} from './online-affection';
import {openTaoyuan} from './taoyuan-portal';
import {installOnlineUI} from './online-ui';
import {installOnlineWorld} from './online-world';
import {installOnlineGame} from './online-game';
import Phaser from 'phaser';
import '../content/apply-copy';
import './style.css';
import './upgrade.css';
import {Cottage,type Zone,type Item} from './scene';
import {birthdayConfig as config,type Gift,type GiftId} from '../content/birthday-config';
import {save,persist,reset,grantItem,restockSnack,useSnack,type Snack} from './state';
import {music,sound,setAmbience,duckAudio} from './audio';
import {gameViewport,localPoint,localDelta,requestImmersive} from './viewport';
import {worlds,actionLabel,inReach} from './world';
import {mediaUrl} from './assets';
import {PixelCeremony} from './celebration';
import {installUI} from './ui';
import {launchGiftGame,disposeGame} from './minigames';
import {playCinema} from './theater';
import {places,restingLines} from '../content/places';
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const scene=new Cottage();
let game:Phaser.Game|undefined;
let viewport=gameViewport(window.innerWidth,window.innerHeight);
let displayScale=save.settings.uiScale/100;
function layoutViewport(){const width=window.visualViewport?.width??window.innerWidth,height=window.visualViewport?.height??window.innerHeight;viewport=gameViewport(width,height);if(document.body.classList.contains('started'))viewport={...viewport,width:viewport.width/displayScale,height:viewport.height/displayScale};const app=$('app');app.style.width=viewport.width+'px';app.style.height=viewport.height+'px';app.style.setProperty('--ui-scale',String(displayScale));app.style.setProperty('--control-size',44/displayScale+'px');app.style.setProperty('--game-canvas-height',Math.max(120,Math.min(360,viewport.height-220))+'px');const plaque=document.querySelector<HTMLElement>('.place-plaque');const progress=$('progress');const progressTop=Math.max(70,(plaque?.offsetTop??12)+(plaque?.offsetHeight??70)+8);app.style.setProperty('--progress-top',progressTop+'px');app.style.setProperty('--minimap-top',(progressTop+(progress?.offsetHeight??24)+12)+'px');app.classList.toggle('rotated',viewport.rotated);app.classList.toggle('compact-hud',viewport.width<1000||viewport.height<550);if(game?.isBooted){game.scale.resize(viewport.width,viewport.height);scene.resizeView()}}
layoutViewport();document.addEventListener('hud-layout',()=>{const app=$('app'),plaque=document.querySelector<HTMLElement>('.place-plaque'),progress=$('progress');const top=Math.max(70,(plaque?.offsetTop??12)+(plaque?.offsetHeight??70)+8);app.style.setProperty('--progress-top',top+'px');app.style.setProperty('--minimap-top',(top+(progress?.offsetHeight??24)+12)+'px')});document.addEventListener('display-scale',(event)=>{const scale=(event as CustomEvent<number>).detail;displayScale=(validDpi(scale)?scale:save.settings.uiScale)/100;layoutViewport()});window.addEventListener('resize',layoutViewport);window.visualViewport?.addEventListener('resize',layoutViewport);
function immersive(){const root=document.documentElement as HTMLElement&{webkitRequestFullscreen?:()=>void};void requestImmersive(root,screen.orientation as ScreenOrientation&{lock?:(orientation:string)=>Promise<void>}).then(result=>{layoutViewport();$('fullscreen').classList.toggle('active',result.fullscreen||Boolean(document.fullscreenElement))})}

let ceremony:PixelCeremony|undefined;
let ready=false,loadFailed=false,modalOpen=false,modalKind='',openingGift=false,lastFocus:HTMLElement|undefined,modalTimer:number|undefined,toastTimer:number,quietTimer:number|undefined,photoUrl='',currentNote=0,started=false,cinematic=false,dialogueOpen=false,activeHint:Item|undefined;
const esc=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function toast(text:string){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').classList.remove('hidden');toastTimer=window.setTimeout(()=>$('toast').classList.add('hidden'),3300)}
function updateHUD(){document.body.classList.toggle('reduced-motion',save.reduced);const count=$('progress').querySelector('b');if(count)count.textContent=String(save.opened.length);$('music').classList.toggle('active',save.music);$('music').classList.toggle('muted',!save.music);$('ceremony-music').classList.toggle('muted',!save.music);$('ceremony-music').setAttribute('aria-pressed',String(save.music));$('music').setAttribute('aria-pressed',String(save.music));$('music').setAttribute('aria-label',save.music?mainText("hud.music-disable"):mainText("hud.music-enable"));$('music').title=save.music?mainText("hud.music-active"):mainText("hud.music-muted");$('progress').setAttribute('aria-label',mainText('hud.progress',{count:save.opened.length}))}
function showModal(html:string,kind='general',closable=true){closeSceneActivity();closeInteractionChoices();duckAudio(true);disposeGame();if(dialogueOpen)closeDialogue();$('nearby').classList.add('hidden');if(!modalOpen)lastFocus=document.activeElement as HTMLElement;modalKind=kind;modalOpen=true;scene.blocked=true;scene.stop();$('modal-content').innerHTML=html;$('modal-backdrop').classList.remove('hidden');$('close-modal').classList.toggle('hidden',!closable||!started);$('modal').scrollTop=0;window.setTimeout(()=>{$('modal').querySelector<HTMLButtonElement>('button:not([disabled])')?.focus()},0)}
function closeModal(){if(openingGift)return;document.dispatchEvent(new Event('cottage-modal-closed'));duckAudio(false);disposeGame();if(modalTimer)clearTimeout(modalTimer);modalOpen=false;modalKind='';$('modal-backdrop').classList.add('hidden');scene.darken(false);scene.blocked=!started||cinematic||scene.transitioning;lastFocus?.focus();if(scene.nearby)showNearby(scene.nearby)}
$('close-modal').onclick=closeModal;
$('modal-backdrop').addEventListener('pointerdown',e=>{if(e.target===$('modal-backdrop')&&started&&modalKind!=='wish'&&modalKind!=='reset')closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sceneActivity){e.preventDefault();closeSceneActivity();return}if(e.key==='Escape'&&interactionChoices){e.preventDefault();closeInteractionChoices();showNearby(scene.nearby);return}if((e.key==='Escape'||e.key==='e'||e.key==='E')&&dialogueOpen){e.preventDefault();e.stopPropagation();closeDialogue();return}if(e.key==='Escape'&&!modalOpen&&!dialogueOpen){if(cinematic&&!ceremony){cinematic=false;scene.blocked=false}scene.stop();return}if(e.key==='Escape'&&started&&modalOpen&&modalKind!=='wish')closeModal();if(e.key==='Tab'&&modalOpen){const items=Array.from($('modal').querySelectorAll<HTMLElement>('button:not(.hidden):not([disabled]),a[href],input,textarea'));const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}});
function action(id:string,fn:()=>void){const element=document.getElementById(id);if(element)element.onclick=fn}
function art(id:GiftId,parent:HTMLElement,size=150){const source=scene.textures.get('gift-'+id).getSourceImage() as HTMLCanvasElement;const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;const ctx=canvas.getContext('2d')!;ctx.imageSmoothingEnabled=false;const ratio=Math.min((size-12)/source.width,(size-12)/source.height);const w=source.width*ratio,h=source.height*ratio;ctx.drawImage(source,(size-w)/2,(size-h)/2,w,h);parent.prepend(canvas)}
function giftArt(gift:Gift){const container=document.querySelector<HTMLElement>('.gift-art');if(container)art(gift.id,container)}
function openGift(gift:Gift,bypass=false){if(!bypass&&!save.cheat&&!save.opened.includes(gift.id)&&!save.games[gift.id]&&!(gift.id==='mystery'&&config.mysteryBoxUnlockMode==='afterCake'&&!save.celebrated)){startGiftGame(gift.id,()=>openGift(gift));return}if(openingGift)return;if(!bypass&&!save.cheat&&gift.id==='mystery'&&config.mysteryBoxUnlockMode==='afterCake'&&!save.celebrated){toast(mainText("gift.secret-locked"));return}if(save.opened.includes(gift.id)){showGift(gift);scene.animateGift(gift.id);return}openingGift=true;scene.stop();scene.blocked=true;sound(659);void scene.playObjectAnimation(gift.id,'gift-opening-v1').catch(()=>toast('动画暂未载入，礼物已为你保留。')).finally(()=>{if(!save.opened.includes(gift.id))save.opened.push(gift.id);if((bypass||save.cheat)&&!save.games[gift.id])save.games[gift.id]={status:'skipped',score:0};if(gift.id==='chestnuts'||gift.id==='chocolate')restockSnack(gift.id);else grantItem(gift.id);openingGift=false;scene.blocked=false;scene.refresh();updateHUD();sound(1046);showGift(gift)})}
const snackSeats:Record<Zone,string>={room:'sofa',garden:'bench',forest:'picnic',pier:'pier-bench',greenhouse:'greenhouse-seat',memory:'memory-seat',station:'station-seat',postoffice:'postal-seat',aquarium:'aquarium-seat',camp:'camp-seat',magic:'magic-seat',haunted:'haunted-seat',cinema:'cinema-seat',ferris:'ferris-seat',mars:'mars-seat',hotspring:'hotspring-seat',market:'market-seat',aurora:'aurora-seat',shichahai:'shichahai-seat',gulou:'gulou-seat',chaya:'chaya-seat',tianmo:'tianmo-seat',tanghulu:'tanghulu-seat',catcottage:'catcottage-seat'};
function shareSnack(id:Snack){
 if(!save.snackPortions[id]){toast(mainText('food.empty'));return}
 const seat=scene.getItem(snackSeats[scene.zone]);
 if(!seat)return;
 closeModal();
 scene.approach(seat,()=>{
  if(!useSnack(id))return;
  scene.affection('share');
  quietLine(mainText(id==='chestnuts'?'chestnuts.share':id==='chocolate'?'chocolate.share':'food.marshmallow-share'));
 });
}
function showGift(gift:Gift){
 if(gift.id==='letter'){showLetter();appendReplay(gift.id);return}if(gift.id==='notes'){currentNote=0;showNotes();appendReplay(gift.id);return}
 let message=gift.message.replace('【待填写赠言】',''),note='',buttons=`<button class="secondary" id="gift-close">${mainHtml("gift.store")}</button>`;
 if(gift.id==='moon'){if(!config.birthDateForMoon||!config.moonImage){message=mainText("moon.pending");note=mainText("moon.disclaimer")}else{message=`${config.birthDateForMoon}\n${message}`}}
 if(gift.id==='hat')buttons=`<button class="primary" id="gift-special">${save.hat?mainHtml("hat.remove"):mainHtml("hat.try")}</button>`+buttons;
 if(gift.id==='band')buttons=`<button class="primary" id="gift-special">${save.band?mainHtml("band.remove"):mainHtml("band.wear")}</button>`+buttons;
 if(gift.id==='earphones')buttons=`<button class="primary" id="gift-special">${save.earphones?mainHtml("earphones.remove"):mainHtml("earphones.wear")}</button>`+buttons;
 if(gift.id==='chestnuts'||gift.id==='chocolate')buttons=`<button class="primary" id="gift-special">${mainHtml('food.share')}</button>`+buttons;
 if(gift.id==='doll')buttons=`<button class="primary" id="gift-special">${mainHtml("doll.touch")}</button>`+buttons;
 if(gift.id==='keychain')buttons=`<button class="primary" id="gift-special">${mainHtml("keychain.shake")}</button>`+buttons;
 if(gift.id==='labubu'){message=config.labubuReveal.text;note=config.labubuReveal.image?'':mainText("labubu.pending")}
 if(gift.id==='mystery'){message=config.mysteryBoxReveal.text;note=mainText("gift.reveal-help")}
 showModal(`<div class="subheading">${mainHtml("gift.opened-eyebrow")}</div><div class="gift-art"></div><h2 id="modal-title">${esc(gift.name)}</h2><div class="subheading">${esc(gift.subtitle)}</div><div class="gift-message">${esc(message)}</div>${gift.variant?`<small class="config-placeholder">${esc(gift.variant)}</small>`:''}${note?`<small class="config-placeholder">${esc(note)}</small>`:''}<div class="modal-actions">${buttons}</div>`,'gift');
 giftArt(gift);if(gift.id==='moon'&&config.birthDateForMoon&&config.moonImage){const img=new Image();img.src=mediaUrl(config.moonImage);img.alt=mainText("moon.image-alt");img.style.cssText='max-width:110px;max-height:110px;position:relative';document.querySelector('.gift-art')!.replaceChildren(img)}
 const reveal=gift.id==='labubu'?config.labubuReveal.image:gift.id==='mystery'?config.mysteryBoxReveal.image:'';if(reveal){const img=new Image();img.src=mediaUrl(reveal);img.alt=mainText("gift.image-alt");img.style.cssText='max-height:120px;max-width:180px;position:relative';document.querySelector('.gift-art')!.replaceChildren(img)}
 appendReplay(gift.id);action('gift-close',closeModal);action('gift-special',()=>{if(gift.id==='hat'){save.hat=!save.hat;persist();scene.refresh();showGift(gift);toast(save.hat?mainText("hat.equipped"):mainText("hat.stored"))}else if(gift.id==='band'){save.band=!save.band;persist();scene.refresh();showGift(gift);toast(mainText("band.equipped"))}else if(gift.id==='earphones'){save.earphones=!save.earphones;persist();scene.refresh();showGift(gift)}else if(gift.id==='chestnuts'||gift.id==='chocolate'){shareSnack(gift.id)}else{const art=document.querySelector<HTMLElement>('.gift-art');art?.classList.add('gift-touched');window.setTimeout(()=>art?.classList.remove('gift-touched'),650);if(scene.zone==='room')scene.animateGift(gift.id);sound();toast(gift.id==='doll'?mainText("doll.response"):mainText("keychain.response"))}})
}
function showLetter(){showModal(`<div class="subheading">${mainHtml('letter.eyebrow')}</div><h2 id="modal-title">${mainHtml('letter.title',{name:config.girlName})}</h2><div class="letter-body" tabindex="0">${esc(config.letterText)}</div><div class="modal-actions"><button class="secondary" id="letter-close">${mainHtml("letter.close")}</button></div>`,'letter');action('letter-close',closeModal)}
function showNotes(){const notes=config.notes.length?config.notes:[mainText("notes.pending")];showModal(`<div class="subheading">${mainHtml("notes.eyebrow")}</div><h2 id="modal-title">${mainHtml("notes.title")}</h2><div class="notes-page">${esc(notes[currentNote].replace(/【可替换示例】/g,''))}</div><div class="note-count">${currentNote+1} / ${notes.length}</div><div class="modal-actions"><button class="secondary" id="note-prev">${mainHtml("notes.previous")}</button><button class="secondary" id="note-next">${mainHtml("notes.next")}</button></div>`,'notes');action('note-prev',()=>{currentNote=(currentNote+notes.length-1)%notes.length;showNotes()});action('note-next',()=>{currentNote=(currentNote+1)%notes.length;showNotes()})}
async function wish(){
 if(cinematic||ceremony)return;cinematic=true;scene.blocked=true;scene.stop();$('nearby').classList.add('hidden');try{await scene.prepareBirthday()}catch{cinematic=false;scene.blocked=false;toast(mainText("ceremony.load-error"));return}
 scene.arrangeCake(()=>{const source=(key:string)=>scene.textures.get(key).getSourceImage() as HTMLImageElement|HTMLCanvasElement;ceremony=new PixelCeremony({cake:source('cake'),backdrop:source('pier'),girl:scene.poseSource('girl',2)!,boy:scene.poseSource('boy',2)!,name:config.girlName,reduced:save.reduced,onBlown:()=>{save.celebrated=true;persist();scene.darken(false)},onDone:()=>{ceremony=undefined;cinematic=false;scene.blocked=false;scene.syncFollowing();celebration()},onCancel:()=>{ceremony=undefined;cinematic=false;scene.blocked=false;scene.darken(false);scene.syncFollowing()}})});
}

function celebration(){showModal(`<div class="celebration"><span class="big-star">✧</span><div class="subheading">${mainHtml('celebration.eyebrow')}</div><h2 id="modal-title">${mainHtml('ceremony.birthday',{name:config.girlName})}</h2><p>${mainHtml("celebration.wish")}<br>${mainHtml("celebration.stay")}</p></div><div class="modal-actions"><button class="primary" id="celebrate-letter">${mainHtml("celebration.letter")}</button><button class="secondary" id="celebrate-photo">${mainHtml("celebration.photo")}</button></div><div class="modal-actions"><button class="secondary" id="celebrate-continue">${mainHtml("celebration.continue")}</button></div>`,'celebration');action('celebrate-letter',()=>{const g=config.gifts.find(g=>g.id==='letter')!;closeModal();openGift(g)});action('celebrate-photo',()=>{closeModal();takePhoto()});action('celebrate-continue',closeModal)}
type Choice={label:string;run:()=>void};
function showDialogue(speaker:string,text:string,choices:Choice[]=[],portrait=true){
 if(modalOpen)return;closeSceneActivity();lastFocus=document.activeElement as HTMLElement;dialogueOpen=true;scene.blocked=true;scene.stop();$('nearby').classList.add('hidden');document.body.classList.add('conversing');
 $('dialogue-speaker').textContent=speaker;$('dialogue-text').textContent=text.replace(/【可替换示例】/g,'');$('dialogue-portrait').classList.toggle('hidden',!portrait);if(portrait){$('dialogue-portrait').style.backgroundImage='url('+scene.avatar('boy')+')';$('dialogue-portrait').style.backgroundSize='contain';$('dialogue-portrait').style.backgroundPosition='center';$('dialogue-portrait').style.backgroundRepeat='no-repeat'}$('dialogue').classList.remove('hidden');const holder=$('dialogue-choices');holder.replaceChildren();
 for(const choice of choices){const button=document.createElement('button');button.className='dialogue-choice';button.textContent=choice.label;button.onclick=choice.run;holder.append(button)}
 $('dialogue-close').focus();
}
function closeDialogue(){if(!dialogueOpen)return;dialogueOpen=false;$('dialogue').classList.add('hidden');document.body.classList.remove('conversing');scene.blocked=modalOpen||cinematic||!started;lastFocus?.focus();showNearby(scene.nearby)}
function quietLine(text:string){if(quietTimer)clearTimeout(quietTimer);$('resting-line').textContent=text;$('resting-line').classList.remove('hidden');quietTimer=window.setTimeout(()=>{if(!scene.seated)$('resting-line').classList.add('hidden')},6500)}
function talk(){
 const lines:Partial<Record<Zone,string>>={hotspring:mainText("talk.hotspring"),market:mainText("talk.market"),aurora:mainText("talk.aurora"),magic:mainText("talk.magic"),haunted:mainText("talk.haunted"),cinema:mainText("talk.cinema"),ferris:mainText("talk.ferris"),mars:mainText("talk.mars"),aquarium:mainText("talk.aquarium"),camp:mainText("talk.camp"),station:mainText("talk.station"),postoffice:mainText("talk.postoffice"),greenhouse:mainText("talk.greenhouse"),memory:mainText("talk.memory"),room:save.celebrated?mainText("talk.room-celebrated"):config.welcome,garden:mainText("talk.garden"),forest:mainText("talk.forest"),pier:mainText("talk.pier")};
 showDialogue(config.boyName==='我'?mainText("talk.speaker"):config.boyName,lines[scene.zone]??worlds[scene.zone].caption,[{label:mainText("talk.hand"),run:()=>{closeDialogue();scene.affection('hand');scene.setFollowing(scene.holding);quietLine(scene.holding?mainText("talk.hand-start"):mainText("talk.hand-stop"))}},{label:mainText("talk.hug"),run:()=>{closeDialogue();scene.affection('hug');quietLine(mainText("talk.hug-response"))}},{label:mainText("talk.dance"),run:()=>{closeDialogue();scene.affection('dance');quietLine(mainText("talk.dance-response"))}},{label:save.following?mainText("talk.follow-continue"):mainText("talk.follow"),run:()=>{closeDialogue();scene.setFollowing(true);quietLine(mainText("talk.follow-response"))}},{label:mainText("talk.birthday"),run:()=>showDialogue(config.boyName,mainText("talk.birthday-response"),[{label:mainText("talk.remember"),run:closeDialogue}])}]);
}
function placeDialogue(id:string){const content=places[id];if(!content)return;scene.remember(id);if(id==='marshmallow')restockSnack('marshmallow');if(id==='cabinet')for(const snack of ['chestnuts','chocolate'] as const)if(save.opened.includes(snack))restockSnack(snack);if(id==='chime')sound(1046);if(id==='shell'||id==='ocean-echo')sound(587);if(content.sit)scene.sit(content.sit);quietLine(content.response)}

function interact(id:string){
 if(modalOpen||dialogueOpen||cinematic)return;if(sceneActivity&&sceneActivity.kind!=='workshop')return;if(id==='taoyuan-portal'){enterTaoyuan();return}if(id.startsWith('game-')){const kind=id.slice(5);startGiftGame(({pairs:'chocolate',rhythm:'earphones',catch:'chestnuts',sequence:'notes',wish:'moon',ribbon:'hat'} as Record<string,GiftId>)[kind]??'notes');return}if(['chair-left','chair-right','greenhouse-seat','memory-seat'].includes(id)){scene.sit(id);return}if(id==='record'){scene.affection('dance');quietLine(mainText("record.jammed"));return}if(id==='seed'||id==='future'){writeFuture(undefined,undefined,undefined,()=>scene.remember(id));return}if(id==='aquarium-wish'){writeFuture('birthday-aquarium-note',mainText("aquarium.note-title"),mainText("aquarium.note-saved"));return}if(id==='post-letter'){writeFuture('birthday-postcard',mainText("postcard.title"),mainText("postcard.saved"));return}const gift=config.gifts.find(g=>g.id===id);if(gift){openGift(gift);return}const item=scene.getItem(id);if(item?.kind==='collect'){enhancements.collect(item);return}if(item?.kind==='slot'){enhancements.bag(item);return}if(['movie','memory-projector','concert','ferris-ride'].includes(id)){openTheater(id);return}if(id.includes('-small-note-0')||['movie-note','mars-message'].includes(id)){writeFuture('birthday-'+id,mainText("moment.title"),mainText("moment.saved"));return}
 if(item?.to){travel(item.to);return}
 if(id.startsWith('sugar-')&&id!=='sugar-photo'){scene.remember(id);openWorkshopAt(id);return}
 if(id==='heartbeat-cards'||id==='heartbeat-jump'){
  const activity=mountSceneActivity('side-game-host','arcade',id==='heartbeat-cards'?'心跳斗地主':'心跳跳一跳');
  openHeartbeat(activity.host,id==='heartbeat-cards'?'cards':'jump',scene.avatar(scene.onlineWorld?.role==='guest'?'boy':'girl'));return;
 }
 if(id==='cat-pet'||id==='cat-play'||id==='cat-feed'){scene.remember(id);quietLine(mainText(id==='cat-pet'?'cat.pet':id==='cat-play'?'cat.play':'cat.feed'));return}
 if(/^(shichahai|gulou|chaya|tianmo|sugar|cat)-photo$/.test(id)){void takePhoto();return}
 if(/^(shichahai|chaya|tianmo|cat)-note$/.test(id)){writeFuture(id);return}
 if(seatDefinition(scene.zone,id)&&!places[id]){scene.sit(id);return}
if(id==='cake')wish();else if(id==='boy')talk();else if(places[id])placeDialogue(id);else if(['sofa','swing','bench','sea'].includes(id))scene.sit(id);
}
function travel(zone:Zone){
 if(!ready||!started||openingGift||cinematic||zone===scene.zone)return;closeSceneActivity();if(dialogueOpen)closeDialogue();if(modalOpen)closeModal();cinematic=true;
 void scene.transitionTo(zone,()=>{cinematic=false;updateHUD();$('location-toast').textContent='✦ '+worlds[zone].name+' ✦';$('location-toast').classList.add('show');window.setTimeout(()=>$('location-toast').classList.remove('show'),2400)});
}
function showNearby(item?:Item){
 activeHint=item;const hint=$('nearby'),button=$<HTMLButtonElement>('interact');const available=Boolean(item&&!modalOpen&&!dialogueOpen&&!scene.blocked&&!cinematic&&started&&!scene.seated&&!scene.movingTo);
 button.disabled=!available;button.querySelector('small')!.textContent=available?actionLabel(item!,save.opened.includes(item!.id as GiftId)):mainText("nearby.approach");
 if(!available||interactionChoices){hint.classList.add('hidden');return}const label=actionLabel(item!,save.opened.includes(item!.id as GiftId));
 hint.innerHTML=`<span class="cue-name">${esc(item!.name)}</span><span class="cue-action"><kbd>E</kbd></span>`;hint.title=label+' '+item!.name;hint.setAttribute('aria-label',label+' '+item!.name);hint.classList.remove('hidden');button.setAttribute('aria-label',label+' '+item!.name);
}

let interactionChoices:HTMLDivElement|undefined;
let hintSize={width:240,height:32};
function closeInteractionChoices(){interactionChoices?.remove();interactionChoices=undefined}
scene.bridge.on('interaction-choices',(items:Item[])=>{
 closeInteractionChoices();if(modalOpen||dialogueOpen||cinematic)return;
 const panel=document.createElement('div');panel.id='interaction-choices';panel.setAttribute('role','dialog');panel.setAttribute('aria-label',mainText('nearby.choose'));panel.tabIndex=-1;
 const heading=document.createElement('div');heading.className='interaction-choice-heading';heading.textContent=mainText('nearby.choose');panel.append(heading);
 const close=document.createElement('button');close.className='interaction-choice-close';close.textContent='×';close.setAttribute('aria-label',mainText('nearby.cancel'));close.onclick=()=>{closeInteractionChoices();showNearby(scene.nearby)};panel.append(close);
 for(const item of items){const button=document.createElement('button');button.className='interaction-choice';button.dataset.item=item.id;button.textContent=actionLabel(item,save.opened.includes(item.id as GiftId))+' · '+item.name;button.onclick=()=>{closeInteractionChoices();if(!scene.blocked)scene.approachById(item.id)};panel.append(button)}
 panel.addEventListener('pointerdown',event=>event.stopPropagation());panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeInteractionChoices();showNearby(scene.nearby)}});
 interactionChoices=panel;$('app').append(panel);$('nearby').classList.add('hidden');panel.querySelector<HTMLButtonElement>('.interaction-choice')?.focus();
});
scene.bridge.on('zone',closeInteractionChoices);scene.bridge.on('approaching',closeInteractionChoices);window.addEventListener('resize',closeInteractionChoices);document.addEventListener('display-scale',closeInteractionChoices);
document.addEventListener('pointerdown',event=>{if(interactionChoices&&!interactionChoices.contains(event.target as Node))closeInteractionChoices()},true);

function journal(){if(!ready||!started||cinematic||scene.transitioning)return;showModal(`<div class="subheading">${mainHtml("journal.eyebrow")}</div><h2 id="modal-title">${mainHtml("journal.title")}</h2><div class="subheading">${mainHtml('journal.progress',{count:save.opened.length})}</div><div class="journal-grid">${config.gifts.map(g=>`<button class="journal-gift ${save.opened.includes(g.id)?'opened':''}" id="journal-${g.id}" aria-label="${esc(g.name)}">${save.opened.includes(g.id)?'':'<span class="journal-empty">✧</span>'}<small>${esc(g.name)}</small></button>`).join('')}</div><small class="config-placeholder">${mainHtml("journal.help")}</small>`,'journal');for(const g of config.gifts){const el=$('journal-'+g.id);if(save.opened.includes(g.id))art(g.id,el,64);el.onclick=()=>{if(save.opened.includes(g.id))showGift(g);else{closeModal();if(scene.zone!=='room'){toast(mainText("journal.wrong-zone"));return}const item={...g};scene.approach(item)}}}}
function settings(){if(!ready||!started||cinematic)return;showModal(`<div class="subheading">${mainHtml("settings.eyebrow")}</div><h2 id="modal-title">${mainHtml("settings.title")}</h2><div class="settings-row"><span>${mainHtml("settings.music")}</span><button class="secondary" id="setting-music">${save.music?mainHtml("settings.enabled"):mainHtml("settings.muted")}</button></div><div class="settings-row"><span>${mainHtml("settings.motion")}</span><button class="secondary" id="setting-motion">${save.reduced?mainHtml("settings.enabled"):mainHtml("settings.disabled")}</button></div><div class="settings-row"><span>${mainHtml("settings.progress")}</span><button class="secondary" id="reset-request">${mainHtml("settings.reset")}</button></div><small class="config-placeholder">${mainHtml("settings.keyboard-help")}<br>${mainHtml("settings.touch-help")}<br>${mainHtml("settings.storage-help")}</small><div class="modal-actions"><button class="secondary" id="settings-close">${mainHtml("settings.close")}</button></div>`,'settings');action('setting-music',()=>{save.music=!save.music;persist();void music(true);updateHUD();settings()});action('setting-motion',()=>{save.reduced=!save.reduced;persist();updateHUD();settings()});action('settings-close',closeModal);action('reset-request',()=>{showModal(`<h2 id="modal-title">${mainHtml("reset.title")}</h2><div class="gift-message">${mainHtml("reset.warning")}<br>${mainHtml("reset.keep-content")}</div><div class="modal-actions"><button class="secondary" id="reset-cancel">${mainHtml("reset.cancel")}</button><button class="primary" id="reset-confirm">${mainHtml("reset.confirm")}</button></div>`,'reset');action('reset-cancel',settings);action('reset-confirm',()=>{reset();closeModal();scene.changeZone('room');scene.refresh();updateHUD();toast(mainText("reset.done"))})})}
async function takePhoto(){if(scene.transitioning)return;if(!ready||!started||cinematic)return;scene.stop();scene.capture(img=>{showModal(`<h2 id="modal-title">${mainHtml("photo.title")}</h2><img id="photo-result" class="photo-result" alt="${mainHtml("photo.alt")}"><div class="modal-actions"><button id="photo-download" class="primary">${mainHtml("photo.save")}</button></div>`,'photo');($('photo-result') as HTMLImageElement).src=img.src;action('photo-download',()=>{const native=(window as Window&{CottageSave?:{postMessage:(data:string)=>void}}).CottageSave;if(native){native.postMessage(JSON.stringify({kind:'image',data:img.src}));return}const a=document.createElement('a');a.href=img.src;a.download=mainText("photo.filename");a.click()})})}
scene.bridge.on('cottage-ready',()=>{if(loadFailed)return;ready=true;void enhancements.begin();document.dispatchEvent(new Event('cottage-ready'));});
scene.bridge.on('load-progress',(value:number)=>{if(!ready&&!loadFailed){$('load-status').textContent=mainText('loading.progress',{percent:Math.round(value*100)});$('load-bar').style.width=Math.round(value*100)+'%';document.dispatchEvent(new CustomEvent('cottage-load-progress',{detail:value*.9}))}});
scene.bridge.on('asset-error',()=>{loadFailed=true;window.dispatchEvent(new Event('error'))});
scene.bridge.on('pet-loading',()=>toast(mainText("pet.loading")));scene.bridge.on('pet-error',()=>toast(mainText("pet.error")));
scene.bridge.on('interact',interact);scene.bridge.on('nearby',showNearby);scene.bridge.on('unreachable',()=>quietLine(mainText("movement.unreachable")));
scene.bridge.on('hint-position',(p:{x:number;y:number})=>{if(!activeHint||interactionChoices||modalOpen||dialogueOpen||cinematic||scene.blocked||scene.seated||scene.movingTo)return;const hint=$('nearby');if(hint.offsetWidth&&hint.offsetHeight)hintSize={width:hint.offsetWidth,height:hint.offsetHeight};const appRect=$('app').getBoundingClientRect(),obstacles=Array.from(document.querySelectorAll<HTMLElement>('#round-minimap,.hud-tools,.place-plaque')).filter(node=>node.offsetWidth&&node.offsetHeight&&!node.classList.contains('hidden')).map(node=>{const r=node.getBoundingClientRect(),a=localPoint(r.left,r.top,appRect,viewport),b=localPoint(r.right,r.bottom,appRect,viewport);return{left:Math.min(a.x,b.x),right:Math.max(a.x,b.x),top:Math.min(a.y,b.y),bottom:Math.max(a.y,b.y)}}),position=hintPosition(p,viewport.width,viewport.height,hintSize.width,hintSize.height,obstacles);hint.classList.toggle('hidden',position.hidden);hint.style.left=position.x+'px';hint.style.top=position.y+'px'});
scene.bridge.on('approaching',(item?:Item)=>{if(item){$('resting-line').classList.add('hidden');$('path-label').textContent=mainText('movement.approach',{item:item.name});$('path-notice').classList.remove('hidden');$('nearby').classList.add('hidden')}else{$('path-notice').classList.add('hidden');showNearby(scene.nearby)}});
scene.bridge.on('destination',(point:{x:number;y:number})=>{const p=scene.project(point.x,point.y),el=$('destination-mark');el.style.left=p.x+'px';el.style.top=p.y+'px';el.classList.remove('ripple');void el.offsetWidth;el.classList.add('ripple')});
scene.bridge.on('zone',(zone:Zone)=>{closeSceneActivity();setAmbience(zone);$('location-name').textContent=worlds[zone].name;$('location-caption').textContent=worlds[zone].caption;$('resting-line').classList.add('hidden');updateHUD()});
scene.bridge.on('seated',(kind:string)=>{$('game-frame').classList.add('seated');$('stand').classList.remove('hidden');$('nearby').classList.add('hidden');quietLine(restingLines[kind]??mainText("resting.fallback"))});
scene.bridge.on('stood',()=>{$('game-frame').classList.remove('seated');$('stand').classList.add('hidden');$('resting-line').classList.add('hidden')});
$('stand').onclick=()=>scene.stand();$('dialogue-close').onclick=closeDialogue;$('cancel-walk').onclick=()=>scene.stop();$('nearby').onclick=e=>{e.stopPropagation();if(activeHint&&!scene.blocked)scene.approach(activeHint)};
// Browsers require a real user gesture for fullscreen and audio, while entry is automatic.
$('music').onclick=()=>{save.music=!save.music;persist();void music(true);updateHUD();toast(save.music?mainText("music.enabled-toast"):mainText("music.muted-toast"))};$('ceremony-music').onclick=()=>{save.music=!save.music;persist();void music(true);updateHUD()};$('journal').onclick=journal;$('fullscreen').onclick=immersive;$('photo').onclick=()=>{void takePhoto()};$('interact').onclick=e=>{e.stopPropagation();if(!scene.blocked)scene.interactNearest()};
$('game').addEventListener('pointerdown',e=>{closeInteractionChoices();if(!ready)return;const local=localPoint(e.clientX,e.clientY,$('app').getBoundingClientRect(),viewport);const world=scene.cameras.main.getWorldPoint(local.x,local.y);scene.tapWorld(world.x,world.y,1/(scene.cameras.main.zoom*displayScale),e.pointerType==='touch'||e.pointerType==='pen')});

const stick=$('joystick'),knob=$('joystick-knob');let stickPointer:number|undefined;
function release(){stickPointer=undefined;scene.joystick={x:0,y:0};knob.style.transform='translate(0,0)'}
function moveStick(e:PointerEvent){if(stickPointer!==e.pointerId||scene.blocked)return;const r=stick.getBoundingClientRect();const delta=localDelta(e.clientX-r.x-r.width/2,e.clientY-r.y-r.height/2,viewport.rotated);const v=stickVector(delta.x,delta.y,Math.min(r.width,r.height),displayScale);knob.style.transform=`translate(${v.offsetX}px,${v.offsetY}px)`;scene.joystick={x:v.x,y:v.y}}
stick.onpointerdown=e=>{e.preventDefault();e.stopPropagation();if(scene.blocked)return;stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);moveStick(e)};stick.onpointermove=e=>{e.stopPropagation();moveStick(e)};stick.onpointerup=release;stick.onpointercancel=release;stick.onlostpointercapture=release;window.addEventListener('blur',()=>{release();scene.stop()});document.addEventListener('visibilitychange',()=>{if(document.hidden){release();scene.stop()}});document.addEventListener('save-error',()=>{$('save-status').textContent=mainText("save.failed")});
window.addEventListener('pagehide',()=>{persist();if(photoUrl)URL.revokeObjectURL(photoUrl)});
game=new Phaser.Game({type:Phaser.CANVAS,parent:'game',width:viewport.width,height:viewport.height,backgroundColor:'#241e26',pixelArt:true,roundPixels:true,antialias:false,scene:[scene],scale:{mode:Phaser.Scale.NONE,autoCenter:Phaser.Scale.NO_CENTER},render:{preserveDrawingBuffer:true},input:{activePointers:3}});
type SceneActivity={kind:'game'|'arcade'|'workshop'|'film';element:HTMLElement;host:HTMLElement;focus:HTMLElement|null;dispose?:()=>void};
let sceneActivity:SceneActivity|undefined;
let workshopVisit:ReturnType<typeof openSugarWorkshop>|undefined;
function closeSceneActivity(){
 const activity=sceneActivity;
 if(!activity)return;
 sceneActivity=undefined;
 activity.dispose?.();
 if(activity.kind==='game')disposeGame();
 workshopVisit=undefined;
 activity.element.remove();
 duckAudio(false);
 scene.blocked=!started||modalOpen||dialogueOpen||cinematic;
 if(activity.focus?.isConnected)activity.focus.focus({preventScroll:true});
 showNearby(scene.nearby);
}
function mountSceneActivity(id:string,kind:SceneActivity['kind'],label:string){
 closeSceneActivity();
 if(modalOpen)closeModal();
 if(dialogueOpen)closeDialogue();
 closeInteractionChoices();
 const focus=document.activeElement as HTMLElement|null;
 const element=document.createElement('section');
 element.className='scene-activity scene-activity-'+kind;
 element.setAttribute('aria-label',label);
 const host=document.createElement('div');host.id=id;
 const close=document.createElement('button');
 close.type='button';close.className='scene-activity-close';close.textContent='×';
 close.setAttribute('aria-label',mainText('scene-activity.close'));
 close.onclick=closeSceneActivity;
 element.addEventListener('keydown',event=>{
  if(event.key!=='Tab'||kind==='workshop')return;
  const items=Array.from(element.querySelectorAll<HTMLElement>('button:not([disabled]),canvas[tabindex]'));
  const first=items[0],last=items.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
 });
 element.append(host,close);
 $('game-frame').append(element);
 const activity:SceneActivity={kind,element,host,focus};
 sceneActivity=activity;
 scene.stop();
 scene.blocked=kind!=='workshop';
 if(scene.blocked){$('nearby').classList.add('hidden');duckAudio(true)}
 $('resting-line').classList.add('hidden');
 window.setTimeout(()=>{if(sceneActivity===activity&&kind!=='workshop')close.focus({preventScroll:true})},0);
 return activity;
}
function openWorkshopAt(station:string){
 if(!workshopVisit){
  const activity=mountSceneActivity('side-game-host','workshop','糖葫芦制作车间');
  workshopVisit=openSugarWorkshop(activity.host,station,id=>scene.approachById(id),id=>{
   const item=scene.getItem(id);
   return Boolean(item&&!scene.movingTo&&inReach(scene.controlledActor,item,scene.walkable));
  });
  activity.dispose=workshopVisit.dispose;
 }else workshopVisit.arrive(station);
}
function startGiftGame(id:GiftId,done?:()=>void){
 const gift=config.gifts.find(g=>g.id===id);
 const activity=mountSceneActivity('game-host','game',gift?.name??'');
 launchGiftGame(id,activity.host,result=>{
  if(sceneActivity!==activity)return;
  closeSceneActivity();
  if(result.status!=='exit')done?.();
 },(scene.textures.get('gift-'+id).getSourceImage() as HTMLCanvasElement).toDataURL());
}
function appendReplay(id:GiftId){
 const button=document.createElement('button');button.className='secondary';
 button.textContent=mainText('game.replay');
 button.onclick=()=>startGiftGame(id,()=>showGift(config.gifts.find(g=>g.id===id)!));
 $('modal-content').append(button);
}
function openTheater(id:string){
 const activity=mountSceneActivity('film-host','film',mainText('cinema.pick'));
 if(id!=='movie'){void screenFilm(id==='concert'?'concert':id==='ferris-ride'?'ferris':'meet',activity);return}
 for(const title of ['meet','travel','birthday'] as const){
  const choice=document.createElement('button');choice.className='secondary';
  choice.textContent=mainText(title==='meet'?'cinema.meet':title==='travel'?'cinema.travel':'cinema.birthday');choice.onclick=()=>void screenFilm(title,activity);
  activity.host.append(choice);
 }
}
async function screenFilm(id:string,activity:SceneActivity){
 activity.host.textContent=mainText('cinema.loading');
 const zone=scene.zone;
 const prepared=scene.prepareCinema();
 let cancelled=false;
 activity.dispose=()=>{cancelled=true;void prepared.then(release,release)};
 function release(){scene.releaseCinema()}
 try{await prepared}catch{
  if(sceneActivity===activity){closeSceneActivity();toast(mainText('cinema.error'))}
  return;
 }
 if(cancelled||sceneActivity!==activity||scene.zone!==zone)return;
 const rect=zone==='cinema'?{x:224,y:33,w:192,h:99}:zone==='memory'?{x:230,y:20,w:186,h:100}:zone==='mars'?{x:152,y:58,w:336,h:184}:{x:145,y:56,w:350,h:195};
 const screen=document.createElement('div');screen.className='scene-projection';
 $('game-frame').append(screen);
 scene.frameProjection(true);
 let frame=0;
 let previousBounds='';
 const project=()=>{
  const top=scene.project(rect.x,rect.y),bottom=scene.project(rect.x+rect.w,rect.y+rect.h);
  const bounds=[top.x,top.y,bottom.x-top.x,bottom.y-top.y].map(Math.round);
  const signature=bounds.join(',');
  if(signature!==previousBounds){
   previousBounds=signature;
   const [left,top,width,height]=bounds.map(value=>value+'px');
   Object.assign(screen.style,{left,top,width,height});
  }
  frame=requestAnimationFrame(project);
 };
 project();
 const dispose=playCinema(id,activity.host,scene,closeSceneActivity,screen);
 activity.dispose=()=>{cancelAnimationFrame(frame);screen.remove();scene.frameProjection(false);dispose();release()};
}
function writeFuture(storageKey='birthday-future',title=mainText("future.title"),savedLine=mainText("future.saved"),onSaved?:()=>void){let old='';try{old=save.notes[storageKey]??localStorage.getItem(storageKey)??''}catch{}showModal(`<div class="subheading">${mainHtml("future.eyebrow")}</div><h2 id="modal-title">${esc(title)}</h2><p>${mainHtml("future.help")}</p><textarea id="future-note" maxlength="500" rows="5" placeholder="${mainHtml('future.placeholder')}"></textarea><div class="modal-actions"><button id="future-save" class="primary">${mainHtml("future.save")}</button></div><small>${mainHtml("future.storage-help")}</small>`);($('future-note') as HTMLTextAreaElement).value=old;action('future-save',()=>{try{save.notes[storageKey]=($('future-note') as HTMLTextAreaElement).value;if(storageKey==='birthday-postcard')grantItem('postcard');persist();closeModal();onSaved?.();scene.confetti();quietLine(savedLine)}catch{toast(mainText("future.save-error"))}})}
action('companion-toggle',()=>{if(started&&!scene.blocked){if(scene.seated){scene.stand();quietLine(mainText("resting.stand"))}else scene.approachById('boy')}});
let taoyuan:ReturnType<typeof openTaoyuan>|undefined;
let onlineWorld:ReturnType<typeof installOnlineWorld>|undefined;
let onlineGame:ReturnType<typeof installOnlineGame>|undefined;
const online=installOnlineUI({open:showModal,close:closeModal,toast,profile:role=>({name:save.names[role==='guest'?'boy':'girl'],appearance:save.appearance[role==='guest'?'boy':'girl']}),onSnapshot:s=>onlineWorld?.handleSnapshot(s,online.getPlayerId()),onMessage:m=>{onlineWorld?.handleMessage(m);onlineGame?.handleMessage(m);if(m.type==='event'&&m.event==='taoyuan-state')taoyuan?.receive({kind:'state',...(m.data as {save:string;route:string})});if(m.type==='event'&&m.event==='taoyuan-field')taoyuan?.receive({kind:'field',...(m.data as TaoyuanField)});if(m.type==='event'&&m.event==='taoyuan-action')taoyuan?.receive({kind:'command',...(m.data as {route:string;index:number;text:string})})},onConnection:s=>{onlineWorld?.handleConnection(s);taoyuan?.setConnected(s==='connected')},onGame:g=>onlineGame?.start(g)});
onlineWorld=installOnlineWorld(scene,online.client);
installOnlineAffection(onlineWorld,{open:showModal,close:closeModal,toast});
onlineGame=installOnlineGame({
 client:online.client,
 open:()=>{mountSceneActivity('online-game-host','arcade','双人礼物门')},
 close:closeSceneActivity,
 getSnapshot:online.getSnapshot,
 getPlayerId:online.getPlayerId,
});
function enterTaoyuan(){
 if(taoyuan||!started)return;scene.stop();scene.blocked=true;cinematic=true;duckAudio(true);
 const snapshot=online.getSnapshot(),me=snapshot?.players.find(p=>p.id===online.getPlayerId());
 const who=me?.role==='guest'?'boy':'girl';
 taoyuan=openTaoyuan({identity:{name:save.names[who],gender:who==='boy'?'male':'female'},role:online.client.state==='connected'&&me?me.role:'offline',onExit:()=>{taoyuan=undefined;cinematic=false;scene.blocked=false;duckAudio(false)},onMessage:payload=>{if(online.client.state!=='connected')return;if(payload.kind==='state')online.client.send({type:'taoyuan-state',save:payload.save,route:payload.route});else if(payload.kind==='command')online.client.send({type:'taoyuan-action',route:payload.route,index:payload.index,text:payload.text});else{const {kind,...field}=payload;online.client.send({type:'taoyuan-field',...field})}}});
 if(me?.role==='guest'&&snapshot?.taoyuan)taoyuan.receive({kind:'state',save:snapshot.taoyuan.save,route:snapshot.taoyuan.route});
}
const onlineButton=document.createElement('button');onlineButton.id='online-toggle';onlineButton.type='button';onlineButton.className='icon-button';onlineButton.setAttribute('aria-label',mainText("online.label"));onlineButton.textContent=mainText("online.label");onlineButton.title=mainText("online.title");onlineButton.onclick=()=>{if(started&&!cinematic&&!openingGift&&!scene.transitioning){scene.bridge.emit('retry-pets');online.openPanel()}};document.querySelector('.hud-tools')!.append(onlineButton);
const enhancements=installUI({scene,canUse:()=>!cinematic&&!openingGift&&!scene.transitioning,open:showModal,close:closeModal,toast,travel,photo:()=>{void takePhoto()},showGift:id=>showGift(config.gifts.find(g=>g.id===id)!),enter:()=>{started=true;scene.enter();updateHUD();document.body.classList.add('started');layoutViewport();immersive();quietLine(config.welcome);if((window as any).__storageMode==='chosen')toast(mainText("storage.chosen"));else if((window as any).__portableReadonly)toast(mainText("storage.system"))},act:kind=>scene.approachForAction(kind),shareSnack});
installRewards({scene,canUse:()=>started&&!cinematic&&!openingGift&&!scene.transitioning,close:()=>{closeSceneActivity();if(dialogueOpen)closeDialogue();if(modalOpen)closeModal()},openGift:id=>openGift(config.gifts.find(g=>g.id===id)!,true),refresh:()=>{scene.refresh();updateHUD();enhancements.refresh()},toast});
scene.bridge.on('zone-error',()=>{cinematic=false;toast(mainText("scene.load-error"))});
scene.bridge.on('station-chime',()=>{sound(523);window.setTimeout(()=>sound(659),450);window.setTimeout(()=>sound(784),900)});

if(import.meta.env.MODE==='e2e')(window as any).__cottage=scene;
window.setInterval(()=>{if(started&&!scene.transitioning){scene.savePosition();persist()}},3000);
window.addEventListener('portable-readonly',()=>toast(mainText("storage.readonly")));

const portalButtons=new Map<string,HTMLButtonElement>();
scene.bridge.on('portal-positions',(points:{id:string;name:string;x:number;y:number}[])=>{
 const host=$('world-signs');if(!host)return;host.hidden=!save.settings.directions;if(host.hidden)return;const live=new Set(points.map(p=>p.id));for(const [id,node]of portalButtons)if(!live.has(id)){node.remove();portalButtons.delete(id)}
 const occupied:{x:number;y:number;w:number;h:number}[]=[];
 for(const p of points){let node=portalButtons.get(p.id);if(!node){node=document.createElement('button');node.className='world-sign';node.textContent=mainText('portal.label',{name:p.name});node.setAttribute('aria-label',mainText('portal.aria',{name:p.name}));node.addEventListener('pointerdown',e=>e.stopPropagation());node.onclick=()=>{if(!modalOpen&&!dialogueOpen&&!cinematic){scene.approachById(p.id)}};host.append(node);portalButtons.set(p.id,node)}
 const w=node.offsetWidth||140,h=node.offsetHeight||44,frame=$('game-frame'),maxW=frame.clientWidth,maxH=frame.clientHeight;let x=Math.max(4,Math.min(maxW-w-4,p.x-w/2)),y=Math.max(68,Math.min(maxH-h-8,p.y-48));
 for(let n=0;n<5&&occupied.some(r=>x<r.x+r.w+4&&x+w+4>r.x&&y<r.y+r.h+4&&y+h+4>r.y);n++)y=Math.max(68,y-h-5);
 node.style.left=x+'px';node.style.top=y+'px';occupied.push({x,y,w,h});
 }
});

document.addEventListener('visibilitychange',()=>{scene.calendarPaused=document.hidden;scene.resetCalendarClock();if(document.hidden){scene.savePosition();persist()}});window.addEventListener('pagehide',()=>{scene.savePosition();persist()});

document.addEventListener('cottage-export-result',event=>{
 const result=(event as CustomEvent<string>).detail;
 if(result==='cancelled')return;
 toast(mainText(result==='saved'?'export.saved':result==='busy'?'export.busy':'export.failed'));
});
