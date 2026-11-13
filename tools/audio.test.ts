import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {transformSync} from 'esbuild';
import {defaults} from '../src/state';

test('rapid scene changes and muting stop every previous music track',async()=>{
 const save=defaults();
 const sounds:Track[]=[];
 class Track {
  paused=true;volume=1;
  constructor(){sounds.push(this)}
  async play(){this.paused=false}
  pause(){this.paused=true}
 }
 const code=transformSync(readFileSync('src/audio.ts','utf8').replaceAll('import.meta.url',"'https://example.test/assets/main.js'"),{format:'cjs',loader:'ts'}).code;
 const module={exports:{} as typeof import('../src/audio')};
 vm.runInNewContext(code,{
  module,exports:module.exports,Audio:Track,URL,performance:{now:()=>0},requestAnimationFrame:()=>1,
  document:{hidden:false,addEventListener(){}},
  require:(name:string)=>name==='./state'?{save}:{}
 });
 const audio=module.exports;
 await audio.music(true);
 audio.setAmbience('cinema');
 audio.setAmbience('garden');
 assert.equal(sounds.length,3);
 assert.ok(sounds[0].paused);
 save.music=false;
 await audio.music();
 assert.ok(sounds.every(track=>track.paused));
});
