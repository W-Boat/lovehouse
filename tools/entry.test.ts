import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {transformSync} from 'esbuild';
import {Signals} from '../src/signals';
import {defaults} from '../src/state';
import {birthdayConfig} from '../content/birthday-config';
import * as world from '../src/world';
import * as viewport from '../src/viewport';
import * as places from '../content/places';
test('entry readiness waits for customization and explicit entry gesture',()=>{
 const html=readFileSync('index.html','utf8'),nodes=new Map<string,any>();
 const element=(id='')=>{const classes=new Set<string>();return{id,style:{},dataset:{},children:[] as any[],classList:{add:(...c:string[])=>c.forEach(v=>classes.add(v)),remove:(...c:string[])=>c.forEach(v=>classes.delete(v)),toggle:(c:string,on:boolean)=>on?classes.add(c):classes.delete(c),contains:(c:string)=>classes.has(c)},setAttribute(){},removeAttribute(){},addEventListener(){},focus(){},append(n:any){this.children.push(n)},replaceChildren(){this.children=[]},getBoundingClientRect:()=>({left:0,top:0,width:844,height:390}),querySelector(){return element()},textContent:'',innerHTML:'',disabled:false}};
 for(const match of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)){const node=element(match[1]);for(const c of /class="([^"]+)"/.exec(match[0])?.[1].split(' ')??[])node.classList.add(c);nodes.set(match[1],node)}
 const body=element('body');const document:any={querySelector:()=>element(),body,activeElement:element(),getElementById:(id:string)=>{assert.ok(nodes.has(id),'missing node '+id);return nodes.get(id)},addEventListener(){},dispatchEvent(){},createElement:()=>element()};
 let instance:any,entered=0,audioCalls=0,fullscreenCalls=0;
 class Scene{resizeView(){};releaseCinema(){};avatar(){return ''};bridge=new Signals();zone='room';blocked=true;seated='';nearby=undefined;joystick={x:0,y:0};constructor(){instance=this}enter(){entered++;this.blocked=false}stop(){}setFollowing(value:boolean){this.following=value}following=false;getItem(){return{id:'boy'}}}
 class Game{isBooted=true;scale={resize(){}}}
 let beginCalls=0,uiContext:any;const deps:any={'./taoyuan-portal':{openTaoyuan(){throw Error('Portal must not open before entry')}},'./online-ui':{installOnlineUI:()=>({client:{},openPanel(){},getSnapshot(){},getPlayerId(){return ''}})},'./online-world':{installOnlineWorld:()=>({handleMessage(){},handleSnapshot(){},handleConnection(){}})},'./online-game':{installOnlineGame:()=>({start(){},handleMessage(){}})},phaser:{__esModule:true,default:{Game,CANVAS:1,Scale:{NONE:0,NO_CENTER:0}}},'../content/apply-copy':{},'./upgrade.css':{},'./ui':{installUI:(ctx:any)=>{uiContext=ctx;return{begin(){beginCalls++},collect(){},bag(){}}}},'./minigames':{disposeGame(){},launchGiftGame(){}},'./theater':{playCinema(){}},'./style.css':{},'./assets':{mediaUrl:(s:string)=>s},'./scene':{Cottage:Scene},'../content/birthday-config':{birthdayConfig},'./state':{save:defaults(),persist(){},reset(){}},'./audio':{music:()=>{audioCalls++},sound(){},setAmbience(){}},'./viewport':{...viewport,requestImmersive:()=>{fullscreenCalls++;return Promise.resolve({})}},'./celebration':{PixelCeremony:class{}},'./world':world,'../content/places':places};
 const code=transformSync(readFileSync('src/main.ts','utf8'),{loader:'ts',format:'cjs',target:'es2022',define:{'import.meta.env.MODE':'"production"'}}).code;
 vm.runInNewContext(code,{module:{exports:{}},exports:{},require:(id:string)=>{assert.ok(id in deps,id);return deps[id]},document,window:{innerWidth:844,innerHeight:390,addEventListener(){},matchMedia:()=>({matches:false}),setTimeout:()=>1,setInterval:()=>1},Event,clearTimeout(){},screen:{orientation:{}},URL:{}});
 assert.equal(entered,0);instance.bridge.emit('cottage-ready');assert.equal(beginCalls,1);assert.equal(entered,0);uiContext.enter();assert.equal(entered,1);assert.ok(body.classList.contains('started'));assert.equal(audioCalls,0);assert.equal(fullscreenCalls,1);
 instance.bridge.emit('interact','boy');assert.equal(nodes.get('dialogue').classList.contains('hidden'),false);assert.ok(nodes.get('modal-backdrop').classList.contains('hidden'));assert.equal(instance.blocked,true);nodes.get('dialogue-choices').children[3].onclick();assert.equal(instance.following,true);assert.ok(nodes.get('dialogue').classList.contains('hidden'));assert.equal(instance.blocked,false);
});
