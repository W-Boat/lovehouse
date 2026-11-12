import argparse,json,os,subprocess,urllib.request,urllib.parse,zipfile,io,time
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('action',choices=['auth','status','download','logs']);p.add_argument('--run',default='');args=p.parse_args()
env=dict(os.environ,GIT_TERMINAL_PROMPT='0',GCM_INTERACTIVE='never');token=os.getenv('GH_TOKEN') or os.getenv('GITHUB_TOKEN')
if not token:
 try:
  r=subprocess.run(['git','credential','fill'],input='protocol=https\nhost=github.com\n\n',capture_output=True,text=True,env=env,timeout=15)
  values=dict(line.split('=',1) for line in r.stdout.splitlines() if '=' in line);token=values.get('password')
 except Exception:pass
headers={'Accept':'application/vnd.github+json','User-Agent':'Lovehouse-build'}
if token:headers['Authorization']='Bearer '+token
class Redirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,req,fp,code,msg,headers,newurl):
  out=super().redirect_request(req,fp,code,msg,headers,newurl)
  if out and urllib.parse.urlparse(newurl).netloc!=urllib.parse.urlparse(req.full_url).netloc:out.remove_header('Authorization')
  return out
urllib.request.install_opener(urllib.request.build_opener(Redirect()))
base='https://api.github.com/repos/W-Boat/lovehouse'
def api(path):return json.load(urllib.request.urlopen(urllib.request.Request(base+path,headers=headers),timeout=30))
if args.action=='auth':print(json.dumps({'credentialAvailable':bool(token)}))
elif args.action=='status':
 for r in api('/actions/runs?per_page=5')['workflow_runs']:print(json.dumps({k:r[k] for k in ['id','status','conclusion','html_url','head_sha']}))
 if args.run:
  for j in api('/actions/runs/'+args.run+'/jobs')['jobs']:print(json.dumps({'job':j['name'],'status':j['status'],'conclusion':j['conclusion'],'steps':[{k:s.get(k) for k in ['name','status','conclusion']} for s in j['steps']]}))
elif args.action=='logs':
 for j in api('/actions/runs/'+args.run+'/jobs')['jobs']:
  if j['conclusion']=='failure':
   req=urllib.request.Request(base+'/actions/jobs/'+str(j['id'])+'/logs?fresh='+str(time.time()),headers=headers)
   text=urllib.request.urlopen(req,timeout=30).read().decode('utf8','replace');Path('../../ci-'+j['name']+'.log').write_text(text,encoding='utf8');print('Saved failed job log:',j['name'])
else:
 for a in api('/actions/runs/'+args.run+'/artifacts')['artifacts']:
  target=Path('../../outputs')/(a['name']+'.zip');req=urllib.request.Request(a['archive_download_url']+'?fresh='+str(time.time()),headers=headers);target.write_bytes(urllib.request.urlopen(req,timeout=120).read());print('Saved '+target.name)
