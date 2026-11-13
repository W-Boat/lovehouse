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

test('dark skin covers cool peach highlights and adjacent shadows while retaining clothing, hair and alpha',()=>{
 const width=10,height=12, pixels=new Uint8ClampedArray(width*height*4);
 const swatches=[
  [5,1,[251,224,216,255]], // pale streak in the fringe
  [3,6,[255,250,248,255]], // shirt highlight
  [4,6,[251,224,218,255]], // hand highlight
  [5,6,[249,210,206,255]], // cooler hand midtone
  [6,6,[187,135,132,180]], // softer boundary
  [5,7,[32,14,18,255]],   // ink
  [5,9,[249,221,214,255]], // leg highlight
  [6,9,[248,217,210,255]], // adjacent leg midtone
 ] as const;
 for(const [x,y,rgba] of swatches)pixels.set(rgba,(y*width+x)*4);
 recolorAppearance(pixels,width,height,'girl',{color:0,skin:3,outfit:0},'girl-pose-4');
 for(const [index,[x,y,rgba]] of swatches.entries()){
  const actual=[...pixels.slice((y*width+x)*4,(y*width+x)*4+4)];
  if([0,1,5].includes(index))assert.deepEqual(actual,[...rgba]);
  else{assert.ok(actual[0]<170);assert.equal(actual[3],rgba[3])}
 }
});
