import test from 'node:test';import assert from 'node:assert/strict';
import {recolorAppearance} from '../src/appearance-colors';
function sample(who:'girl'|'boy',rgb:number[],outfit:number,skin=0,x=5,y=6){const p=new Uint8ClampedArray(10*10*4);p.set([...rgb,255],(y*10+x)*4);recolorAppearance(p,10,10,who,{color:0,skin,outfit});return [...p.slice((y*10+x)*4,(y*10+x)*4+4)]}
test('both original garment palettes visibly change for both alternate outfits',()=>{for(const who of ['girl','boy'] as const){const rgb=who==='boy'?[110,88,56]:[105,150,182];assert.deepEqual(sample(who,rgb,0),[...rgb,255]);const rose=sample(who,rgb,1),cream=sample(who,rgb,2);assert.notDeepEqual(rose,[...rgb,255]);assert.notDeepEqual(cream,[...rgb,255]);assert.notDeepEqual(rose,cream)}});
test('skin choices preserve opaque silhouette and leave ink, white cloth and red earpiece unchanged',()=>{for(let skin=0;skin<4;skin++){const p=sample('boy',[248,205,175],0,skin,5,3);assert.equal(p[3],255);if(skin)assert.notDeepEqual(p,[248,205,175,255]);for(const rgb of [[40,31,29],[230,225,210],[180,30,35]])assert.deepEqual(sample('boy',rgb,2,skin),[...rgb,255])}});
test('brown hair and trousers outside the vest region remain unchanged',()=>{for(const [x,y]of [[5,3],[5,8],[1,6]])assert.deepEqual(sample('boy',[110,88,56],2,0,x,y),[110,88,56,255])});
import {captureRaisedHands,restoreRaisedHands} from '../src/appearance-colors';
test('head replacement can preserve disconnected raised hands and their ink',()=>{
 const w=20,h=20,p=new Uint8ClampedArray(w*h*4);for(let y=3;y<8;y++)for(let x=7;x<13;x++)p.set([248,205,175,255],(y*w+x)*4);
 for(let y=8;y<11;y++)for(let x=1;x<4;x++)p.set([248,205,175,255],(y*w+x)*4);p.set([40,31,29,255],(8*w)*4);
 const saved=captureRaisedHands(p,w,h,12);assert.ok(saved.length>=10);const cleared=new Uint8ClampedArray(p.length);restoreRaisedHands(cleared,saved);
 assert.deepEqual([...cleared.slice((9*w+2)*4,(9*w+2)*4+4)],[248,205,175,255]);assert.equal(cleared[(5*w+10)*4+3],0);assert.equal(cleared[8*w*4+3],255);
});
