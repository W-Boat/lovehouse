"""Build pinned, vendored Taoyuan as an isolated local child app; no server launch."""
from pathlib import Path
import zipfile,json,subprocess,shutil,hashlib,os,re
root=Path(__file__).resolve().parents[1]
archive=root/'vendor/taoyuan/source.zip'
work=Path(os.environ.get('LOVEHOUSE_TAOYUAN_BUILD',str(root/'work/taoyuan-build')))
work.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(archive) as source:
 for entry in source.infolist():
  relative=Path(*Path(entry.filename).parts[1:])
  if not relative.parts or entry.is_dir():continue
  if relative.anchor or '..' in relative.parts:raise ValueError('Invalid upstream path')
  target=work/relative;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(source.read(entry))
# The embedded birthday edition has no upstream analytics or third-party scripts.
html_path=work/'index.html'
html=html_path.read_text(encoding='utf8')
html,removed=re.subn(r'<!--\s*统计勿删\s*-->\s*<script>.*?</script>', '',html,count=1,flags=re.S)
if removed!=1 or 'sdk.51.la' in html:raise ValueError('Review upstream analytics block before embedding')
html_path.write_text(html,encoding='utf8')
# Customize only the pinned embedded menu. Preserve upstream license files.
menu_path=work/'src/views/MainMenu.vue'
menu=menu_path.read_text(encoding='utf8')
menu,count=re.subn(r'\s*<Button\s+v-if="!Capacitor\.isNativePlatform\(\) && !isElectron"[^>]*>[\s\S]*?赞助作者\s*</Button>', '',menu,count=1)
if count!=1:raise ValueError('Review upstream sponsorship entry')
menu,count=re.subn(r'\s*<!-- 赞助作者[^>]*-->[\s\S]*?(?=\n        </div>)', '',menu,count=1)
if count!=1:raise ValueError('Review upstream sponsorship panel')
menu,count=re.subn(r'\s*<!-- 隐私协议弹窗 -->\s*<Transition[^>]*>[\s\S]*?</Transition>', '',menu,count=1)
if count!=1:raise ValueError('Review upstream privacy panel')
menu=menu.replace('@click="showPrivacy = true"','@click="showCharCreate = true"')
menu=menu.replace("const charName = ref('')","const inheritedIdentity = new URLSearchParams(location.search)\n  const inheritedName = [...(inheritedIdentity.get('lovehouse-name') || '')].slice(0, 12).join('')\n  const inheritedGender: Gender = inheritedIdentity.get('lovehouse-gender') === 'female' ? 'female' : 'male'\n  const charName = ref(inheritedName)")
menu=menu.replace("const charGender = ref<Gender>('male')","const charGender = ref<Gender>(inheritedGender)")
menu=menu.replace("charName.value = ''","charName.value = inheritedName").replace("charGender.value = 'male'","charGender.value = inheritedGender")
menu=menu.replace('maxlength="4"','maxlength="12"').replace(".slice(0, 4), charGender.value)",".slice(0, 12), charGender.value)")
menu=menu.replace('<p class="text-xs text-muted">游戏灵感来自 Stardew Valley</p>','<p class="text-xs text-muted">桃源乡 · 生日小屋联机改编版</p><a href="./LICENSE" target="_blank" class="text-xs underline">上游署名与 CC BY-NC 4.0 许可</a>')
menu_path.write_text(menu,encoding='utf8')
# A guest receives a working copy. Keep it out of the player's personal slots.
save_store=work/'src/stores/useSaveStore.ts'
store_source=save_store.read_text(encoding='utf8')
prefix="const SAVE_KEY_PREFIX = 'taoyuanxiang_save_'"
if store_source.count(prefix)!=1:raise ValueError('Review Taoyuan save storage before embedding')
store_source=store_source.replace(prefix,"const SAVE_KEY_PREFIX = new URLSearchParams(location.search).get('lovehouse-role') === 'guest' ? 'lovehouse_taoyuan_guest_' : 'taoyuanxiang_save_'")
save_store.write_text(store_source,encoding='utf8')
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
destination=root/'public/taoyuan'
destination.mkdir(parents=True,exist_ok=True)
# The destination contains only build output. Keep old hashed bundles out of
# subsequent packages while preserving the original source archive.
output=work/'dist'
for previous in destination.rglob('*'):
 if previous.is_file() and previous.name not in {'LICENSE','UPSTREAM.md'} and not (output/previous.relative_to(destination)).is_file():
  if not previous.resolve().is_relative_to(destination.resolve()):
   raise ValueError('Generated Taoyuan file resolves outside its output directory')
  previous.unlink()
shutil.copytree(output,destination,dirs_exist_ok=True)
for filename in ['LICENSE','UPSTREAM.md']:shutil.copy(root/'vendor/taoyuan'/filename,destination/filename)
(root/'docs/taoyuan-build.json').write_text(json.dumps({'upstream':'https://github.com/setube/taoyuan','commit':'2fd4bf8259e25ba4910cfed0d10a867428ff7299','archiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'license':'CC BY-NC 4.0','localBuild':True},indent=2),encoding='utf8')
