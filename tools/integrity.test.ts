import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync,existsSync} from 'node:fs';
import {additionalTextureFiles} from '../src/assets';
const zones=['garden','forest','pier','station','postoffice','camp','ferris','market','mars'];
function webp(path:string){const bytes=readFileSync(path);assert.ok(bytes.length>32,path);assert.equal(bytes.toString('ascii',0,4),'RIFF',path);assert.equal(bytes.toString('ascii',8,12),'WEBP',path)}
test('all runtime source modules remain nonempty after atomic edits',()=>{
 for(const folder of ['src','content'])for(const file of readdirSync(folder))if(/\.(ts|css)$/.test(file))assert.ok(statSync(folder+'/'+file).size>0,folder+'/'+file);
});
test('lazy action and all 72 seasonal backgrounds exist in public and production build',()=>{
 const files=[...Object.values(additionalTextureFiles),...zones.flatMap(zone=>['spring','summer','autumn','winter'].flatMap(season=>['night','day'].map(period=>`seasons/${zone}-${season}-${period}.webp`)))];
 assert.equal(files.length,73);
 for(const filename of files){webp('public/assets/'+filename);if(existsSync('dist/index.html'))webp('dist/assets/'+filename)}
});
