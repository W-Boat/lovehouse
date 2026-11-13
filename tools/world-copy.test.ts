import {execFileSync} from 'node:child_process';
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {birthdayConfig} from '../content/birthday-config';
import {films} from '../content/films';
import {validateCloudInteractions} from '../content/cloud-interactions.mjs';
import {validateCloudScenes} from '../content/cloud-scenes.mjs';
import {applyWorldCopy,installCloudScenes,installCloudInteractions} from '../content/apply-copy';import {worlds,type World} from '../src/world';
test('scene and per-zone object copy changes presentation without altering IDs, portals, position or navigation',()=>{
 const original=worlds.garden,world:World={...original,items:original.items.map(i=>({...i,point:[...i.point] as [number,number]}))};const fixed=world.items.map(({name,action,...rest})=>rest),floor=world.walkable;
 const item=world.items.find(i=>i.id==='swing')!;applyWorldCopy({'scene.garden.name':'海风小院','scene.garden.caption':'和你慢慢走','item.garden.swing.name':'两个人的秋千','item.garden.swing.action':'一起歇会'},{garden:world});assert.equal(world.name,'海风小院');assert.equal(world.caption,'和你慢慢走');assert.equal(item.name,'两个人的秋千');assert.equal(item.action,'一起歇会');applyWorldCopy({'item.garden.swing.action':''},{garden:world});assert.equal(item.action,'一起歇会');assert.deepEqual(world.items.map(({name,action,...rest})=>rest),fixed);assert.equal(world.walkable,floor);assert.equal(worlds.garden.name,original.name);
 const before=world.items[0].name;applyWorldCopy({['item.room.'+world.items[0].id+'.name']:'不应跨区域匹配'},{garden:world});assert.equal(world.items[0].name,before);
});
test('exported document uses unique legal IDs, matches Python import grammar, and contains every scene/item copy slot',()=>{
 const text=readFileSync('文案.md','utf8'),starts=[...text.matchAll(/<!-- copy:([^\s]+) -->/g)].map(m=>m[1]),matches=[...text.matchAll(/<!-- copy:([a-z0-9.-]+) -->\s*([\s\S]*?)\s*<!-- \/copy:\1 -->/g)];assert.equal(new Set(starts).size,starts.length);assert.equal(matches.length,starts.length);const ids=new Set(starts);
 for(const [zone,w]of Object.entries(worlds)){for(const field of ['name','caption'])assert.ok(ids.has('scene.'+zone+'.'+field));for(const i of w.items)for(const field of ['name','action'])assert.ok(ids.has('item.'+zone+'.'+i.id+'.'+field))}
 for(const gift of birthdayConfig.gifts)for(const field of ['name','subtitle','message','variant'])assert.ok(ids.has('gift.'+gift.id+'.'+field));
 for(const id of ['labubu','mystery'])assert.ok(ids.has('gift.'+id+'.reveal'));
 for(const id of Object.keys(films))assert.ok(ids.has('film.'+id+'.title'));
 // The regex strips surrounding whitespace intentionally; internal newlines survive.
 const specimen='<!-- copy:item.garden.swing.name -->\n第一行\n第二行\n<!-- /copy:item.garden.swing.name -->';assert.equal([...specimen.matchAll(/<!-- copy:([a-z0-9.-]+) -->\s*([\s\S]*?)\s*<!-- \/copy:\1 -->/g)][0][2],'第一行\n第二行');
});

test('the actual Python importer regex round-trips all exported IDs and values',()=>{
 const result=execFileSync('python',['-c',`import ast,re,json
from pathlib import Path
tree=ast.parse(Path('tools/apply_copy.py').read_text(encoding='utf8'))
pattern=next(n.args[0].value for n in ast.walk(tree) if isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute) and n.func.attr=='findall')
text=Path('文案.md').read_text(encoding='utf-8-sig')
pairs=re.findall(pattern,text)
assert len(pairs)==len(re.findall(r'<!-- copy:',text))
assert len(dict(pairs))==len(pairs)
assert json.loads(json.dumps(dict(pairs),ensure_ascii=False))==dict(pairs)
assert all(re.fullmatch('[a-z0-9.-]+',key) for key,_ in pairs)
print(len(pairs))`],{encoding:'utf8'});assert.ok(Number(result.trim())>1000);
});


test('published interactions use the real walkable floor and cannot replace existing points',()=>{
 const original=worlds.ferris;
 const world={...original,items:[...original.items]};
 const dialogue:Parameters<typeof installCloudInteractions>[2]={};
 const base={id:'cloud-ticket',zone:'ferris',x:320,y:370,point:[320,370],name:'票根',action:'翻看',response:'留一张票根。'};
 const parsed=validateCloudInteractions([base,{...base,id:'cloud-blocked',point:[0,0]},{...base,id:'cloud-unknown',zone:'missing'}])!;
 installCloudInteractions(parsed,{ferris:world},dialogue);
 installCloudInteractions(parsed,{ferris:world},dialogue);
 assert.equal(world.items.length,original.items.length+1);
 assert.equal(world.items.at(-1)?.texture,'ui-letter');
 assert.equal(dialogue['cloud-ticket'].response,base.response);
 assert.throws(()=>validateCloudInteractions([base,base]));
 assert.throws(()=>validateCloudInteractions([{...base,id:'ferris-ride'}]));
});


test('cloud interaction portals require HTTPS and cannot also launch a game',()=>{
 const base={id:'cloud-film',zone:'ferris',x:320,y:370,point:[320,370],name:'放映室',action:'打开',response:'看看今晚的放映。'};
 const world={...worlds.ferris,items:[...worlds.ferris.items]};
 const [portal]=validateCloudInteractions([{...base,url:'https://example.org/film'}])!;
 installCloudInteractions([portal],{ferris:world},{});
 assert.equal(world.items.at(-1)?.webPortal,'https://example.org/film');
 assert.equal(world.items.at(-1)?.texture,'ui-door');
 for(const invalid of [
  {url:'http://example.org/'},{url:'https://user@example.org/'},
  {url:'javascript:alert(1)'},{url:'https://example.org/',game:'moon'},{game:'unknown'}
 ])assert.throws(()=>validateCloudInteractions([{...base,...invalid}]));
});


test('published scenes connect in both directions and accept independently configured interactions',()=>{
 const definitions:Record<string,World>={ferris:{...worlds.ferris,items:[...worlds.ferris.items]}};
 const raw={id:'cloud-terrace',parent:'ferris',name:'海风露台',caption:'海风轻轻吹。',background:'https://example.org/terrace.webp',
  entrance:[320,370],spawn:[320,370],exit:[330,375],floor:[[100,240],[540,400]]};
 const scenes=validateCloudScenes([raw,{...raw,id:'cloud-blocked',entrance:[0,0]}])!;
 installCloudScenes(scenes,definitions);
 installCloudScenes(scenes,definitions);
 const terrace=definitions[raw.id];
 assert.equal(definitions.ferris.items.filter(item=>item.to===raw.id).length,1);
 assert.equal(terrace.items[0].to,'ferris');
 assert.equal(terrace.backgroundUrl,raw.background);
 assert.equal(definitions['cloud-blocked'],undefined);
 assert.equal(terrace.walkable({x:99,y:370}),false);
 const interactions=validateCloudInteractions([{id:'cloud-card',zone:raw.id,x:320,y:340,point:[320,355],
  name:'留言卡',action:'读一句',response:'晚风也会记得。'}])!;
 installCloudInteractions(interactions,definitions,{});
 assert.equal(terrace.items.at(-1)?.id,'cloud-card');
 assert.throws(()=>validateCloudScenes([raw,raw]));
});
