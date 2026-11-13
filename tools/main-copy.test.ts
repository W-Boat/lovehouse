import test from 'node:test';import assert from 'node:assert/strict';import personal from '../content/personal.json';import {mainCopyDefaults,mainText,mainHtml} from '../content/main-copy';
test('main copy IDs are stable ASCII and replacement values preserve placeholders and escape HTML',()=>{
 const ids=Object.keys(mainCopyDefaults);assert.equal(new Set(ids).size,ids.length);assert.ok(ids.length>150);assert.ok(ids.every(id=>/^[a-z0-9.-]+$/.test(id)));
 assert.equal(mainText('hud.progress',{count:3}),'已拆开 3 份心意');assert.equal(mainText('letter.title',{name:'你'}),'写给你的信');assert.equal(mainText('ceremony.birthday',{name:'你'}),'生日快乐，你。');
 const texts=personal.texts as Record<string,string>,key='main-ui.letter.title',old=texts[key];try{texts[key]='给{name}的 <b>信</b>';assert.equal(mainText('letter.title',{name:'<A>&'}),'给<A>&的 <b>信</b>');assert.equal(mainHtml('letter.title',{name:'<A>&'}),'给&lt;A&gt;&amp;的 &lt;b&gt;信&lt;/b&gt;');assert.equal(mainText('letter.title'),'给{name}的 <b>信</b>')}finally{if(old===undefined)delete texts[key];else texts[key]=old}
});
