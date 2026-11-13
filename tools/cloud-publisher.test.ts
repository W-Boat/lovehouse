import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createContentHandler,prepareSnapshot} from './cloud-content.mjs';

function request(handler,method,url,headers={},body=''){
 const input=Object.assign(Readable.from([Buffer.from(body)]),{method,url,headers});
 const result={status:0,headers:{} as Record<string,string>,body:''};
 const response={
  writeHead(status:number,headers:Record<string,string>){Object.assign(result,{status,headers});return response},
  end(body=''){result.body=body;return response}
 };
 return handler(input,response).then(()=>result);
}

test('publisher requires authorization and preserves the public revision protocol',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'lovehouse-publisher-'));
 try{
  const handler=createContentHandler({file:join(directory,'content.json'),token:'fixture-token'});
  const headers={authorization:'Bearer fixture-token','content-type':'application/json','if-match':'""'};
  assert.equal((await request(handler,'GET','/admin/api/snapshot')).status,401);
  assert.equal((await request(handler,'POST','/admin/api/publish',{'content-type':'application/json'},'{}')).status,401);
  assert.equal((await request(handler,'GET','/admin/api/snapshot',headers)).body,'{}');
  const config={texts:{welcome:'开门啦'}};
  const data=JSON.stringify(config);
  const revision=prepareSnapshot(config).revision;
  assert.deepEqual(JSON.parse((await request(handler,'POST','/admin/api/check',headers,data)).body),{revision});
  assert.equal((await request(handler,'GET','/content.json')).status,503);
  const concurrent=await Promise.all([
   request(handler,'POST','/admin/api/publish',headers,data),
   request(handler,'POST','/admin/api/publish',headers,JSON.stringify({texts:{welcome:'另一个版本'}})),
  ]);
  assert.deepEqual(concurrent.map(result=>result.status),[200,412]);
  assert.equal((await request(handler,'GET','/content.json?revision='+revision)).status,304);
  assert.equal(JSON.parse((await request(handler,'GET','/content.json')).body).texts.welcome,'开门啦');
  assert.equal((await request(handler,'POST','/admin/api/publish',headers,'[')).status,400);
  assert.equal((await request(handler,'POST','/admin/api/publish',headers,' '.repeat(1_000_001))).status,400);
  assert.equal((await request(handler,'GET','/admin/assets/%2e%2e%2fcontent.json')).status,404);
 }finally{await rm(directory,{recursive:true,force:true})}
});

test('publisher detects invalid scene references and accepts its own snapshots as inputs',()=>{
 const config=prepareSnapshot({giftGames:{moon:'https://example.org/game/'}});
 assert.equal(prepareSnapshot(JSON.parse(config.json)).revision,config.revision);
 const item={zone:'cloud-missing',id:'cloud-test',x:5,y:5,point:[5,5],name:'test',action:'try',response:'done'};
 assert.throws(()=>prepareSnapshot({interactions:[item]}),/Unknown interaction scene/);
 assert.throws(()=>prepareSnapshot({scene:[]}),/Unknown configuration field/);
});

test('publisher manages public inert assets and protects active references',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'lovehouse-media-'));
 try{
  const handler=createContentHandler({file:join(directory,'content.json'),token:'fixture-token'});
  const auth={authorization:'Bearer fixture-token'};
  const name=encodeURIComponent('开场歌词.lrc');
  const body='[00:01.20]第一句';
  assert.equal((await request(handler,'GET','/admin/api/assets')).status,401);
  assert.equal((await request(handler,'POST','/admin/api/assets',{...auth,'x-asset-name':'bad.svg'},'<svg/>')).status,400);
  assert.equal((await request(handler,'POST','/admin/api/assets',{...auth,'x-asset-name':'bad.png'},'<html/>')).status,400);
  assert.equal((await request(handler,'POST','/admin/api/assets',{...auth,'x-asset-name':name,'content-length':'16777217'},body)).status,400);
  const saved=await request(handler,'POST','/admin/api/assets',{...auth,'x-asset-name':name},body);
  assert.equal(saved.status,201);
  const {asset}=JSON.parse(saved.body);
  assert.equal(asset.name,'开场歌词.lrc');
  assert.equal(asset.mime,'text/plain; charset=utf-8');
  const duplicate=JSON.parse((await request(handler,'POST','/admin/api/assets',{...auth,'x-asset-name':'other.lrc'},body)).body);
  assert.equal(duplicate.asset.id,asset.id);
  assert.deepEqual(JSON.parse((await request(handler,'GET','/admin/api/assets',auth)).body).assets,[asset]);
  const publicAsset=await request(handler,'GET',asset.path);
  assert.equal(publicAsset.status,200);
  assert.equal(publicAsset.body.toString(),body);
  assert.equal(publicAsset.headers['Access-Control-Allow-Origin'],'*');
  const range=await request(handler,'GET',asset.path,{range:'bytes=0-2'});
  assert.equal(range.status,206);
  assert.equal(range.body.toString(),'[00');
  assert.equal((await request(handler,'GET',asset.path,{range:'bytes=999-'})).status,416);
  assert.equal((await request(handler,'GET','/media/..%2fcontent.json')).status,404);
  const published=await request(handler,'POST','/admin/api/publish',{...auth,'content-type':'application/json'},
    JSON.stringify({musicRoom:{mode:'offline',localTracks:[{name:'Song',artist:'Artist',url:'https://example.org/song.mp3',cover:'',lrc:'https://example.org'+asset.path}]}}));
  assert.equal(published.status,200);
  const removal='/admin/api/assets/'+asset.id;
  assert.equal((await request(handler,'DELETE',removal,auth)).status,409);
  assert.equal((await request(handler,'POST','/admin/api/publish',{...auth,'content-type':'application/json'},'{}')).status,200);
  assert.equal((await request(handler,'DELETE',removal,auth)).status,200);
  assert.equal((await request(handler,'GET',asset.path)).status,404);
 }finally{await rm(directory,{recursive:true,force:true})}
});


test('prefixed publisher preserves asset links and protects published references',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'lovehouse-prefix-'));
 try{
  const handler=createContentHandler({file:join(directory,'content.json'),token:'fixture',publicPrefix:'/lovehouse'});
  const auth={authorization:'Bearer fixture','content-type':'application/json'};
  const saved=await request(handler,'POST','/admin/api/assets',{...auth,'x-asset-name':'song.lrc'},'[00:01]Hello');
  const {asset}=JSON.parse(saved.body);
  assert.equal(asset.path,'/lovehouse/media/'+asset.id);
  const body=JSON.stringify({musicRoom:{mode:'offline',localTracks:[{name:'Song',artist:'Artist',url:'https://example.org/song.mp3',cover:'',lrc:'https://example.org'+asset.path}]}});
  assert.equal((await request(handler,'POST','/admin/api/publish',auth,body)).status,200);
  assert.equal((await request(handler,'DELETE','/admin/api/assets/'+asset.id,auth)).status,409);
  assert.equal((await request(handler,'GET',asset.path.replace('/lovehouse',''))).status,200);
 }finally{await rm(directory,{recursive:true,force:true})}
});

