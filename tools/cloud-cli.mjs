#!/usr/bin/env node
import {readFile,writeFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {basename} from 'node:path';
import {Readable} from 'node:stream';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {prepareSnapshot} from './cloud-content.mjs';

const args=process.argv.slice(2);
const command=args.shift();
const flag=name=>{
 const index=args.indexOf(name);
 if(index<0)return;
 if(index+1>=args.length)throw Error('Missing '+name);
 return args.splice(index,2)[1];
};
const envFile=flag('--env')??'.ENV';
try{
 for(const line of (await readFile(envFile,'utf8')).split(/\r?\n/)){
  const match=/^\s*(LOVEHOUSE_[A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if(match&&!process.env[match[1]])process.env[match[1]]=match[2].replace(/^(['"])(.*)\1$/,'$2');
 }
}catch(error){if(error.code!=='ENOENT')throw error}
const baseValue=flag('--base')??process.env.LOVEHOUSE_CONTENT_SERVER;
const expected=flag('--if-match');
const file=flag('--file');
const binary=flag('--binary');
const output=flag('--output');
const tokenFile=flag('--token-file');
const token=tokenFile?(await readFile(tokenFile,'utf8')).trim():process.env.LOVEHOUSE_ADMIN_TOKEN;
const getJson=async path=>JSON.parse((await readFile(path,'utf8')).replace(/^\uFEFF/,''));
const print=value=>console.log(JSON.stringify(value,null,2));
function requireArgs(count){if(args.length!==count)throw Error('Unexpected arguments. Run help.')}
function base(){
 const url=new URL(baseValue);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('Set an HTTPS LOVEHOUSE_CONTENT_SERVER');
 url.pathname=url.pathname.replace(/\/?$/,'/');
 return url;
}
async function request(method,path,body,headers={}){
 const origin=base(),url=new URL(path,origin);
 if(!path.startsWith('admin/api/')&&!['content.json','packages.json','android-update/update.json'].includes(path))throw Error('Use a publisher API path');
 if(url.origin!==origin.origin||!url.pathname.startsWith(origin.pathname))throw Error('Invalid API path');
 if(!token&&path!=='admin/api/login')throw Error('Set LOVEHOUSE_ADMIN_TOKEN or pass --token-file');
 if(expected!==undefined)headers['If-Match']=JSON.stringify(expected==='new'?'':expected);
 const response=await fetch(url,{
  method,body,headers:{...(token?{Authorization:'Bearer '+token}:{}),...headers},
  redirect:'error',signal:AbortSignal.timeout(binary||command==='package-upload'?300000:30000),
  ...(body instanceof Readable?{duplex:'half'}:{}),
 });
 if(!response.ok)throw Error('HTTP '+response.status+' '+(await response.text()).slice(0,1000));
 if(response.status===204)return {};
 return response.json();
}
async function sendFile(path,filename,headers={}){
 const info=await stat(filename);
 if(!info.isFile())throw Error('Expected a file');
 return request('POST',path,createReadStream(filename),{'Content-Type':'application/octet-stream','Content-Length':String(info.size),...headers});
}
const help={
 usage:'node tools/cloud-cli.mjs COMMAND [arguments] [--env .ENV] [--base HTTPS_BASE] [--token-file FILE] [--if-match REVISION] [--output FILE]',
 commands:{'bucket-get':'查看储存桶设置（隐藏凭据）','bucket-test INPUT.json':'测试储存桶读写和清理','bucket-set INPUT.json':'验证并保存储存桶连接','storage-set INPUT.json':'保存存储阈值与路由规则',storage:'查看发布服务器的存储模式','opening-get':'查看定时开放规则','opening-set INPUT.json':'保存定时开放规则，文件包含 enabled、opensAt、allowIps',version:'CLI、Skill 与源码版本',
  snapshot:'读取线上配置',catalog:'全部包内素材和配置',assets:'素材列表',stats:'去重在线统计',
  history:'远程发布历史','history-show REVISION':'读取历史配置',packages:'安装包与历史','update-manifest':'公开签名资源清单',
  'check INPUT.json':'本地完整校验','publish INPUT.json --if-match REVISION':'校验并发布全部配置',
  'upload FILE':'上传图片、音频、HTML、JSON 或 ZIP 文件','asset-delete ID':'删除未引用素材','asset-refs ID':'查素材引用',
  'rollback REVISION --if-match CURRENT_REVISION':'回滚历史配置',
  'package-upload android|windows VERSION FILE':'流式上传安装包',
  'package-select INPUT.json --if-match CURRENT_PATH':'选择历史安装包，INPUT 含 platform/path',
  'android-publish DIRECTORY':'上传签名清单及缺失哈希资源，需 Python',
  'request GET|POST|DELETE API_PATH [--file JSON_FILE|--binary FILE]':'覆盖全部发布后台接口。账号登录会话可用 LOVEHOUSE_ADMIN_TOKEN 传入',
 },
};
try{
 if(['version','--version','-v'].includes(command)){
  const versions=JSON.parse(await readFile(new URL('../content/tooling-version.json',import.meta.url),'utf8'));
  const git=spawnSync('git',['rev-parse','--short=12','HEAD'],{cwd:fileURLToPath(new URL('..',import.meta.url)),encoding:'utf8'});
  print({name:'lovehouse-cli',version:versions.cli,skillVersion:versions.skill,revision:git.status===0?git.stdout.trim():'unknown'});process.exit(0);
 }
 if(!command||command==='help'){print(help);process.exit(0)}
 const reads={snapshot:'snapshot',catalog:'bundled',assets:'assets',stats:'statistics','bucket-get':'storage/bucket',storage:'storage','opening-get':'opening',history:'history',packages:'packages'};
 let result;
 if(command in reads){requireArgs(0);result=await request('GET','admin/api/'+reads[command])}
 else if(command==='bucket-set'||command==='bucket-test'){
  requireArgs(1);
  const path='admin/api/storage/bucket'+(command==='bucket-test'?'/test':'');
  result=await request('POST',path,JSON.stringify(await getJson(args[0])),{'Content-Type':'application/json'});
 }
 else if(command==='storage-set'){
  requireArgs(1);
  const {rules:current}=await request('GET','admin/api/storage');
  result=await request('POST','admin/api/storage',JSON.stringify({current,next:await getJson(args[0])}),{'Content-Type':'application/json'});
 }
 else if(command==='opening-set'){
  requireArgs(1);
  const current=await request('GET','admin/api/opening');
  result=await request('POST','admin/api/opening',JSON.stringify({current,next:await getJson(args[0])}),{'Content-Type':'application/json'});
 }
 else if(command==='update-manifest'){requireArgs(0);result=await request('GET','android-update/update.json')}
 else if(command==='history-show'){requireArgs(1);result=await request('GET','admin/api/history/'+encodeURIComponent(args[0]))}
 else if(command==='check'){requireArgs(1);result={revision:prepareSnapshot(await getJson(args[0])).revision}}
 else if(command==='publish'){
  requireArgs(1);if(expected===undefined)throw Error('Pass --if-match with the current revision');
  result=await request('POST','admin/api/publish',prepareSnapshot(await getJson(args[0])).json,{'Content-Type':'application/json'});
 }else if(command==='upload'){
  requireArgs(1);result=await sendFile('admin/api/assets',args[0],{'X-Asset-Name':encodeURIComponent(basename(args[0]))});
  result.asset.url=new URL(result.asset.path,base()).href;
 }else if(command==='asset-delete'||command==='asset-refs'){
  requireArgs(1);result=await request(command==='asset-delete'?'DELETE':'GET','admin/api/assets/'+encodeURIComponent(args[0])+(command==='asset-refs'?'/references':''));
 }else if(command==='rollback'){
  requireArgs(1);if(expected===undefined)throw Error('Pass --if-match with the current revision');
  result=await request('POST','admin/api/rollback',JSON.stringify({revision:args[0]}),{'Content-Type':'application/json'});
 }else if(command==='package-upload'){
  requireArgs(3);if(!['android','windows'].includes(args[0]))throw Error('Invalid platform');
  result=await sendFile('admin/api/packages?platform='+args[0]+'&version='+encodeURIComponent(args[1]),args[2]);
 }else if(command==='package-select'){
  requireArgs(1);if(expected===undefined)throw Error('Pass --if-match with the current package path');
  result=await request('POST','admin/api/packages/select',JSON.stringify({...await getJson(args[0]),expected:expected==='new'?null:expected}),{'Content-Type':'application/json'});
 }else if(command==='android-publish'){
  requireArgs(1);
  const run=spawnSync('python',[fileURLToPath(new URL('./publish_android_update.py',import.meta.url)),args[0],base().href],{stdio:'inherit',env:{...process.env,LOVEHOUSE_ADMIN_TOKEN:token??''}});
  if(run.error)throw run.error;process.exit(run.status??1);
 }else if(command==='request'){
  requireArgs(2);if(!['GET','POST','DELETE'].includes(args[0]))throw Error('Invalid method');
  if(file&&binary)throw Error('Choose a JSON or binary body');
  const headers=file?{'Content-Type':'application/json'}:{};
  const body=file?JSON.stringify(await getJson(file)):binary?createReadStream(binary):undefined;
  if(binary){headers['Content-Type']='application/octet-stream';headers['Content-Length']=String((await stat(binary)).size)}
  result=await request(args[0],args[1],body,headers);
 }else throw Error('Unknown command. Run help.');
 if(result!==undefined){if(output){await writeFile(output,JSON.stringify(result,null,2));print({output})}else print(result)};
}catch(error){console.error(JSON.stringify({error:error.message}));process.exitCode=1}
