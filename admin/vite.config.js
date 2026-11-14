import {defineConfig} from 'vite';
import vue from '@vitejs/plugin-vue';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const versions=JSON.parse(readFileSync(new URL('../content/tooling-version.json',import.meta.url),'utf8'));
let revision='unknown';
try{revision=execFileSync('git',['rev-parse','--short=12','HEAD'],{cwd:new URL('..',import.meta.url),encoding:'utf8'}).trim()}catch{}
const build={revision,builtAt:new Date().toISOString(),...versions};
export default defineConfig({plugins:[vue()],base:(process.env.LOVEHOUSE_PUBLIC_PREFIX||'')+'/admin/',define:{__PUBLISHER_BUILD__:JSON.stringify(build)}});
