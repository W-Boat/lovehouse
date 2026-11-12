"""Package reviewed CI binaries; never launches or deploys the game."""
from pathlib import Path
import hashlib,json,subprocess,zipfile
root=Path(__file__).resolve().parents[1]
out=root.parent.parent/'outputs';out.mkdir(exist_ok=True)
metadata=json.loads((root/'docs/ci-result.json').read_text(encoding='utf8'))
assert metadata['webBuild']=='success' and metadata['clientBuild']=='success','Both CI builds must finish before packaging'
assert not subprocess.check_output(['git','diff',metadata['codeCommit'],'--','src','content','index.html','public','src-tauri'],cwd=root),'Runtime source must match the verified CI commit'
receipts=json.loads((out/'artifact-receipts.json').read_text(encoding='utf8'))
for name in ['lovehouse-web-and-checks','lovehouse-windows-x64-portable']:
 assert str(receipts[name]['run'])==str(metadata['ciRun']),'Artifact must come from the verified CI run'
 assert hashlib.sha256((out/(name+'.zip')).read_bytes()).hexdigest()==receipts[name]['sha256'],'Artifact checksum mismatch'
web=zipfile.ZipFile(out/'lovehouse-web-and-checks.zip')
windows=zipfile.ZipFile(out/'lovehouse-windows-x64-portable.zip')
licenses=[p for p in (root/'public/assets').glob('*.txt') if 'LICENSE' in p.name.upper() or 'OFL' in p.name.upper()]
source=out/'birthday-cottage-v2-18-scenes-source.zip'
paths=subprocess.check_output(['git','ls-files','-z','--cached','--others','--exclude-standard'],cwd=root).decode().split('\0')
with zipfile.ZipFile(source,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as target:
 for name in sorted(set(paths)):
  if not name or any(part in ['node_modules','.git','dist','target','test-results','playwright-report'] for part in Path(name).parts):continue
  path=root/name
  if path.is_file() and not path.name.startswith('.env'):target.write(path,'birthday-cottage-v2/'+name)
 target.writestr('birthday-cottage-v2/build-info.json',json.dumps(metadata,ensure_ascii=False,indent=2))
website=out/'birthday-cottage-v2-18-scenes-web.zip'
with zipfile.ZipFile(website,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as target:
 for name in web.namelist():
  if name.startswith('dist/') and not name.endswith('/'):
   data=web.read(name)
   if name.endswith('.js'):assert b'__cottage' not in data,'CI debug build must not be delivered'
   target.writestr(name[5:],data)
 for path in licenses:
  if 'dist/assets/'+path.name not in web.namelist():target.write(path,'assets/'+path.name)
 target.write(root/'docs/素材来源.md','素材来源.md')
 target.writestr('build-info.json',json.dumps(metadata,ensure_ascii=False,indent=2))
client=out/'birthday-cottage-v2-windows-x64.zip'
with zipfile.ZipFile(client,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as target:
 executables=[n for n in windows.namelist() if n.endswith('/lovehouse.exe') or n=='lovehouse.exe'];assert len(executables)==1
 target.writestr('lovehouse.exe',windows.read(executables[0]))
 target.writestr('build-info.json',json.dumps(metadata,ensure_ascii=False,indent=2))
 for path in licenses:target.write(path,'licenses/'+path.name)
 target.write(root/'public/audio/CREDITS.txt','licenses/audio-CREDITS.txt')
 for path in [root/'docs/Windows便携版.md',root/'docs/素材来源.md',root/'文案.md',root/'需替换内容.md']:target.write(path,path.name)
checks={}
for path in [source,website,client]:
 with zipfile.ZipFile(path) as archive:assert archive.testzip() is None
 checks[path.name]={'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
(out/'交付文件校验.json').write_text(json.dumps(checks,indent=2,ensure_ascii=False),encoding='utf8')
print(json.dumps(checks,indent=2,ensure_ascii=False))
