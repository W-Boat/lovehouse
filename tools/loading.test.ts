import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {transformSync} from 'esbuild';
test('failed boot keeps its pixel cover and offers reload without revealing the framework',()=>{
 const listeners=new Map<string,Function>(),nodes=new Map<string,any>();let reloaded=false;
 for(const id of ['boot-progress','boot-percent','boot-text','boot-retry'])nodes.set(id,{hidden:true,textContent:'',setAttribute(){},querySelectorAll(){return[]}});
 const body={dataset:{} as Record<string,string>};
 const document={body,getElementById:(id:string)=>nodes.get(id),addEventListener:(name:string,fn:Function)=>listeners.set(name,fn)};
 const window={addEventListener:(name:string,fn:Function)=>listeners.set(name,fn),setTimeout:()=>1};
 const source=readFileSync('src/bootstrap.ts','utf8').replace("void import('./cloud-content').then(module=>module.syncCloudContent()).catch(()=>{}).then(()=>import('./main')).catch(showFailure);",'');
 vm.runInNewContext(transformSync(source,{loader:'ts',format:'cjs'}).code,{document,window,clearTimeout(){},location:{reload(){reloaded=true}}});
 listeners.get('error')!();assert.equal(body.dataset.bootState,'error');assert.equal(nodes.get('boot-retry').hidden,false);assert.match(nodes.get('boot-text').textContent,/重试/);
 const errorText=nodes.get('boot-text').textContent;listeners.get('cottage-load-progress')!({detail:.8});assert.equal(nodes.get('boot-text').textContent,errorText);
 nodes.get('boot-retry').onclick();assert.equal(reloaded,true);
 const html=readFileSync('index.html','utf8');assert.doesNotMatch(html,/body\[data-boot-state=error\] #boot-cover\{display:none/);assert.match(html,/id="boot-retry" type="button" hidden/);
});
