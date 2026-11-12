import argparse,json,os,subprocess,urllib.request,zipfile,io
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('action',choices=['auth','status','download']);p.add_argument('--run',default='');args=p.parse_args()
env=dict(os.environ,GIT_TERMINAL_PROMPT='0',GCM_INTERACTIVE='never');token=os.getenv('GH_TOKEN') or os.getenv('GITHUB_TOKEN')
if not token:
 try:
  r=subprocess.run(['git','credential','fill'],input='protocol=https\nhost=github.com\n\n',capture_output=True,text=True,env=env,timeout=15)
  values=dict(line.split('=',1) for line in r.stdout.splitlines() if '=' in line);token=values.get('password')
 except Exception:pass
headers={'Accept':'application/vnd.github+json','User-Agent':'Lovehouse-build'}
if token:headers['Authorization']='Bearer '+token
base='https://api.github.com/repos/W-Boat/lovehouse'
def api(path):return json.load(urllib.request.urlopen(urllib.request.Request(base+path,headers=headers),timeout=30))
if args.action=='auth':print(json.dumps({'credentialAvailable':bool(token)}))
elif args.action=='status':
 for r in api('/actions/runs?per_page=5')['workflow_runs']:print(json.dumps({k:r[k] for k in ['id','status','conclusion','html_url','head_sha']}))
 if args.run:
  for j in api('/actions/runs/'+args.run+'/jobs')['jobs']:print(json.dumps({'job':j['name'],'status':j['status'],'conclusion':j['conclusion'],'steps':[{k:s.get(k) for k in ['name','status','conclusion']} for s in j['steps']]}))
else:
 for a in api('/actions/runs/'+args.run+'/artifacts')['artifacts']:
  target=Path('../../outputs')/(a['name']+'.zip');req=urllib.request.Request(a['archive_download_url'],headers=headers);target.write_bytes(urllib.request.urlopen(req,timeout=120).read());print('Saved '+target.name)
