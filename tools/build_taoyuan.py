"""Build pinned, vendored Taoyuan as an isolated local child app; no server launch."""
from pathlib import Path
import zipfile,json,subprocess,shutil,hashlib,os
root=Path(__file__).resolve().parents[1]
archive=root/'vendor/taoyuan/source.zip'
work=Path(os.environ.get('LOVEHOUSE_TAOYUAN_BUILD',str(root/'work/taoyuan-build')))
work.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(archive) as source:
 for entry in source.infolist():
  relative=Path(*Path(entry.filename).parts[1:])
  if not relative.parts or entry.is_dir():continue
  if '..' in relative.parts:raise ValueError('Invalid upstream path')
  target=work/relative;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(source.read(entry))
package=json.loads((work/'package.json').read_text())
package['devDependencies']={'@vue/tsconfig':'0.8.1','@types/node':'24.10.1','vite':'7.3.0','@vitejs/plugin-vue':'6.0.1','typescript':'5.9.3','tailwindcss':'3.4.19','autoprefixer':'10.4.24','postcss':'8.5.6'}
package['scripts']={'build':'vite build'}
(work/'package.json').write_text(json.dumps(package,ensure_ascii=False),encoding='utf8')
(work/'vite.config.ts').write_text("import {defineConfig} from 'vite';import vue from '@vitejs/plugin-vue';import {resolve} from 'node:path';export default defineConfig({base:'./',plugins:[vue()],resolve:{alias:{'@':resolve(import.meta.dirname,'src')}},build:{outDir:'dist'}})",encoding='utf8')
shutil.copy(root/'tools/taoyuan-bridge.ts',work/'lovehouse-bridge.ts')
with (work/'src/main.ts').open('a',encoding='utf8') as target:target.write("\nimport {installLovehouseBridge} from '../lovehouse-bridge';installLovehouseBridge();\n")
command='npm.cmd' if os.name=='nt' else 'npm'
lock=root/'vendor/taoyuan/web-package-lock.json'
if lock.exists():shutil.copy(lock,work/'package-lock.json')
subprocess.run([command,'ci' if lock.exists() else 'install','--ignore-scripts','--no-audit','--no-fund'],cwd=work,check=True)
subprocess.run([command,'run','build'],cwd=work,check=True)
destination=root/'public/taoyuan';shutil.copytree(work/'dist',destination,dirs_exist_ok=True)
for filename in ['LICENSE','UPSTREAM.md']:shutil.copy(root/'vendor/taoyuan'/filename,destination/filename)
(root/'docs/taoyuan-build.json').write_text(json.dumps({'upstream':'https://github.com/setube/taoyuan','commit':'2fd4bf8259e25ba4910cfed0d10a867428ff7299','archiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'license':'CC BY-NC 4.0','localBuild':True},indent=2),encoding='utf8')
