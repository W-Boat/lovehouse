import {execFileSync} from 'node:child_process';
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {applyWorldCopy} from '../content/apply-copy';import {worlds,type World} from '../src/world';
test('scene and per-zone object copy changes presentation without altering IDs, portals, position or navigation',()=>{
 const original=worlds.garden,world:World={...original,items:original.items.map(i=>({...i,point:[...i.point] as [number,number]}))};const fixed=world.items.map(({name,action,...rest})=>rest),floor=world.walkable;
 const item=world.items.find(i=>i.id==='swing')!;applyWorldCopy({'scene.garden.name':'海风小院','scene.garden.caption':'和你慢慢走','item.garden.swing.name':'两个人的秋千','item.garden.swing.action':'一起歇会'},{garden:world});assert.equal(world.name,'海风小院');assert.equal(world.caption,'和你慢慢走');assert.equal(item.name,'两个人的秋千');assert.equal(item.action,'一起歇会');applyWorldCopy({'item.garden.swing.action':''},{garden:world});assert.equal(item.action,'一起歇会');assert.deepEqual(world.items.map(({name,action,...rest})=>rest),fixed);assert.equal(world.walkable,floor);assert.equal(worlds.garden.name,original.name);
 const before=world.items[0].name;applyWorldCopy({['item.room.'+world.items[0].id+'.name']:'不应跨区域匹配'},{garden:world});assert.equal(world.items[0].name,before);
});
test('exported document uses unique legal IDs, matches Python import grammar, and contains every scene/item copy slot',()=>{
 const text=readFileSync('文案.md','utf8'),starts=[...text.matchAll(/<!-- copy:([^\s]+) -->/g)].map(m=>m[1]),matches=[...text.matchAll(/<!-- copy:([a-z0-9.-]+) -->\s*([\s\S]*?)\s*<!-- \/copy:\1 -->/g)];assert.equal(new Set(starts).size,starts.length);assert.equal(matches.length,starts.length);const ids=new Set(starts);
 for(const [zone,w]of Object.entries(worlds)){for(const field of ['name','caption'])assert.ok(ids.has('scene.'+zone+'.'+field));for(const i of w.items)for(const field of ['name','action'])assert.ok(ids.has('item.'+zone+'.'+i.id+'.'+field))}
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
