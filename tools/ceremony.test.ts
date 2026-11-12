import test from 'node:test';
import assert from 'node:assert/strict';
import {pixelBurst,PixelCeremony} from '../src/celebration';
test('pixel fireworks have radial trails and bounded lifetimes',()=>{const sparks=pixelBurst(320,100,'#ffe1a0',()=>.5);assert.equal(sparks.length,68);assert.ok(sparks.every(p=>[2,3].includes(p.size)&&p.life>1&&p.life<3&&p.x===320&&p.y===100));assert.ok(sparks.some(p=>p.vx>60));assert.ok(sparks.some(p=>p.vx< -60));assert.ok(sparks.some(p=>p.vy< -60))});
test('fullscreen candle sequence blows once, plays fireworks and safely skips',()=>{
 const ids=['ceremony','ceremony-canvas','ceremony-title','ceremony-caption','ceremony-action','ceremony-close','game-frame','app'];const nodes=new Map<string,any>();const ctx=new Proxy({},{get:()=>()=>{}});
 for(const id of ids){const classes=new Set<string>();nodes.set(id,{classList:{add:(c:string)=>classes.add(c),remove:(c:string)=>classes.delete(c),contains:(c:string)=>classes.has(c)},dataset:{},inert:false,width:640,height:296,offsetWidth:844,offsetHeight:390,getContext:()=>ctx,focus(){}})}
 const originals={document:globalThis.document,raf:globalThis.requestAnimationFrame,cancel:globalThis.cancelAnimationFrame};Object.assign(globalThis,{document:{getElementById:(id:string)=>nodes.get(id)},requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{}});
 try{let blown=0,done=0,cancelled=0;const image={} as CanvasImageSource,scene=new PixelCeremony({cake:image,backdrop:image,girl:image,boy:image,name:'你',reduced:false,onBlown:()=>blown++,onDone:()=>done++,onCancel:()=>cancelled++});assert.equal(nodes.get('game-frame').inert,true);assert.equal(nodes.get('ceremony').dataset.stage,'wish');
 nodes.get('ceremony-action').onclick();nodes.get('ceremony-action').onclick();assert.equal(blown,1);assert.equal(nodes.get('ceremony').dataset.stage,'smoke');for(let i=0;i<45;i++)(scene as any).frame(i*40);assert.equal(nodes.get('ceremony').dataset.stage,'fireworks');nodes.get('ceremony-close').onclick();nodes.get('ceremony-close').onclick();assert.equal(done,1);assert.equal(cancelled,0);assert.equal(nodes.get('game-frame').inert,false);assert.equal(nodes.get('ceremony').classList.contains('hidden'),true);
 }finally{Object.assign(globalThis,{document:originals.document,requestAnimationFrame:originals.raf,cancelAnimationFrame:originals.cancel})}
});
