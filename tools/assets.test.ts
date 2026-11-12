import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveAssetUrl,textureFiles} from '../src/assets';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
test('runtime image URLs follow the deployed JS directory rather than the domain root',()=>{
 for(const filename of Object.values(textureFiles)){
  assert.equal(resolveAssetUrl(filename,'https://letter.080726.xyz/birthday/assets/main-hash.js'),'https://letter.080726.xyz/birthday/assets/'+filename);
  assert.equal(resolveAssetUrl(filename,'https://game.example/assets/main.js'),'https://game.example/assets/'+filename);
  assert.equal(resolveAssetUrl(filename,'https://game.example/a/b/c/assets/main.js'),'https://game.example/a/b/c/assets/'+filename);
 }
});
test('dev image URLs work with default and configured base paths',()=>{
 assert.equal(resolveAssetUrl('hero.png','http://localhost:5173/src/assets.ts',true,'./'),'http://localhost:5173/assets/hero.png');
 assert.equal(resolveAssetUrl('hero.png','http://localhost:5173/birthday/src/assets.ts',true,'/birthday/'),'http://localhost:5173/birthday/assets/hero.png');
});
test('production output has portable entry/CSS references and packages every required WebP',()=>{
 if(!existsSync('dist/index.html'))return;const html=readFileSync('dist/index.html','utf8');assert.ok(!/(?:src|href)=["']\/assets\//.test(html));
 for(const filename of readdirSync('dist/assets').filter(s=>s.endsWith('.css'))){const css=readFileSync('dist/assets/'+filename,'utf8');assert.ok(!/url\(["']?\/assets\//.test(css),filename)}
 for(const filename of Object.values(textureFiles)){const bytes=readFileSync('dist/assets/'+filename);assert.equal(bytes.subarray(0,4).toString(),'RIFF',filename)}
});
