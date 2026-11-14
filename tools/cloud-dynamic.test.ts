import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
// @ts-ignore Shared server/client schema.
import {prepareSnapshot} from './cloud-content.mjs';
import {verifyCloudSnapshot} from '../src/cloud-content';
import {validateCloudScenes} from '../content/cloud-scenes.mjs';
const layer={id:'book',src:'https://example.com/book.webp',x:320,y:200,width:64,height:64,depth:4,autoplay:false,trigger:'cloud-book',frames:{columns:4,rows:2,fps:8,loop:false},path:{points:[[320,200],[320,170]],seconds:2}};
const scene={id:'cloud-demo',parent:'room',name:'动态小屋',caption:'测试',background:'https://example.com/room.webp',entrance:[439,343],spawn:[320,350],exit:[320,380],floor:[[200,280],[480,390]],layers:[layer]};
test('dynamic scene snapshot survives identical server/client canonicalization',async()=>{
 if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto});
 const snapshot=prepareSnapshot({scenes:[scene],interactions:[{id:'cloud-book',zone:'cloud-demo',x:320,y:290,point:[320,310],name:'魔法书',action:'翻开',response:'书页飞起来了。'}]});
 const parsed=await verifyCloudSnapshot(JSON.parse(snapshot.json));
 assert.deepEqual(parsed.scenes?.[0].layers?.[0],layer);
});
test('invalid animation grids and cross-scene triggers are rejected before publishing',()=>{
 assert.throws(()=>validateCloudScenes([{...scene,layers:[{...layer,frames:{columns:16,rows:16,fps:8,loop:true}}]}]));
 assert.throws(()=>prepareSnapshot({scenes:[scene],interactions:[{id:'cloud-book',zone:'room',x:320,y:290,point:[320,310],name:'书',action:'翻开',response:'翻开了'}]}),/same scene/);
});
