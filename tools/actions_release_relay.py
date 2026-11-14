"""Automatically relay verified Actions artifacts through an operator machine.
No publisher credential is embedded in clients or artifacts. HTTPS remains verified.
"""
import argparse,base64,collections,hashlib,http.client,io,json,os,re,runpy,subprocess,sys,time,urllib.error,urllib.parse,urllib.request,zipfile
from pathlib import Path

class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args):return None

class RemoteZip(io.RawIOBase):
 def __init__(self,url):
  self.url=url;self.pos=0;self.blocks=collections.OrderedDict();self.block_size=8*1024*1024
  with self.get(0,0) as r:
   match=re.fullmatch(r'bytes 0-0/(\d+)',r.headers.get('Content-Range',''))
   if not match:raise RuntimeError('Artifact server must support byte ranges')
   self.size=int(match[1])
 def get(self,start,end):
  return urllib.request.urlopen(urllib.request.Request(self.url,headers={'Range':f'bytes={start}-{end}'}),timeout=60)
 def seekable(self):return True
 def readable(self):return True
 def tell(self):return self.pos
 def seek(self,offset,whence=0):
  self.pos=offset if whence==0 else self.pos+offset if whence==1 else self.size+offset
  if self.pos<0:raise ValueError('Negative offset')
  return self.pos
 def read(self,n=-1):
  if n<0:n=self.size-self.pos
  n=min(n,self.size-self.pos);parts=[]
  while n>0:
   block=self.pos//self.block_size
   if block not in self.blocks:
    start=block*self.block_size;end=min(self.size-1,start+self.block_size-1)
    for attempt in range(4):
     try:
      with self.get(start,end) as r:
       if r.status!=206 or r.headers.get('Content-Range')!=f'bytes {start}-{end}/{self.size}':raise RuntimeError('Unexpected artifact range')
       data=r.read(end-start+1)
       if len(data)!=end-start+1:raise RuntimeError('Incomplete artifact range')
      self.blocks[block]=data;break
     except Exception:
      if attempt==3:raise RuntimeError('Artifact range download failed') from None
      time.sleep(2)
    while len(self.blocks)>8:self.blocks.popitem(last=False)
   data=self.blocks[block];offset=self.pos%self.block_size;part=data[offset:offset+n]
   if not part:raise RuntimeError('Empty artifact range')
   parts.append(part);n-=len(part);self.pos+=len(part)
  return b''.join(parts)

def main():
 p=argparse.ArgumentParser();p.add_argument('--sha',required=True);p.add_argument('--base',default='https://server.080726.xyz/lovehouse/');p.add_argument('--token-file',required=True);p.add_argument('--output',default='work-release-relay');p.add_argument('--wait-minutes',type=int,default=45)
 args=p.parse_args();repo=Path(__file__).resolve().parent.parent;os.chdir(repo)
 token=Path(args.token_file).read_text().strip();assert len(token)>12
 original=sys.argv;sys.argv=['tools/github_ci.py','auth'];gh=runpy.run_path(str(repo/'tools/github_ci.py'));sys.argv=original
 root=Path(args.output).resolve()/args.sha[:12];root.mkdir(parents=True,exist_ok=True)
 def api(path):
  for attempt in range(4):
   try:return gh['api'](path)
   except Exception:
    if attempt==3:raise RuntimeError('GitHub API is temporarily unavailable') from None
    time.sleep(2)
 def artifact_url(item):
  req=urllib.request.Request(item['archive_download_url']+'?fresh='+str(time.time()),headers=gh['headers'])
  try:urllib.request.build_opener(NoRedirect()).open(req,timeout=30)
  except urllib.error.HTTPError as e:
   if e.code!=302:raise RuntimeError('Artifact authorization failed') from None
   url=e.headers['Location']
   if urllib.parse.urlsplit(url).scheme!='https':raise RuntimeError('HTTPS artifact required')
   return url
  raise RuntimeError('Missing artifact redirect')
 def send(path,data,mime='application/octet-stream'):
  request=urllib.request.Request(args.base.rstrip('/')+'/'+path,data=data,headers={'Authorization':'Bearer '+token,'Content-Type':mime,'Content-Length':str(len(data))},method='POST')
  with urllib.request.urlopen(request,timeout=300) as response:return json.load(response)
 def publish_package(platform,path):
  result=subprocess.run(['node',str(repo/'tools/cloud-cli.mjs'),'package-upload',platform,args.sha[:12],str(path),'--base',args.base,'--token-file',args.token_file],capture_output=True,text=True,encoding='utf8',timeout=330)
  if result.returncode:raise RuntimeError('CLI package publication failed: '+result.stderr[:300])
  entry=json.loads(result.stdout);expected=hashlib.file_digest(path.open('rb'),'sha256').hexdigest()
  if entry['sha256']!=expected:raise RuntimeError('Published package checksum mismatch')
  print(json.dumps({'published':platform,'version':entry['version'],'sha256':expected}),flush=True)
 completed=set();deadline=time.monotonic()+args.wait_minutes*60
 while time.monotonic()<deadline:
  runs=[r for r in api('/actions/runs?per_page=30')['workflow_runs'] if r['head_sha'].startswith(args.sha)]
  for run in runs:
   if run['name'] not in ['Lovehouse builds','Lovehouse Android APK']:continue
   for item in api('/actions/runs/'+str(run['id'])+'/artifacts')['artifacts']:
    name=item['name']
    if name in completed or name not in ['lovehouse-android-offline','lovehouse-windows-x64-portable','lovehouse-content-update']:continue
    print('Preparing '+name,flush=True)
    remote=RemoteZip(artifact_url(item))
    with zipfile.ZipFile(remote) as archive:
     if name=='lovehouse-android-offline':
      member=next(n for n in archive.namelist() if n.endswith('.apk'));target=root/'lovehouse.apk'
      with archive.open(member) as src,target.open('wb') as out:
       while chunk:=src.read(1024*1024):out.write(chunk)
      publish_package('android',target)
     elif name=='lovehouse-windows-x64-portable':
      target=root/'lovehouse-windows.zip'
      with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as out:
       for member in archive.namelist():
        if member.endswith('lovehouse.exe') or member.endswith('.md') or member.endswith('commit.txt') or member.endswith('sha256.txt'):
         with archive.open(member) as src,out.open(Path(member).name,'w') as dest:
          while chunk:=src.read(1024*1024):dest.write(chunk)
      publish_package('windows',target)
     else:
      member=next(n for n in archive.namelist() if n.endswith('update.json'));signed=archive.read(member);manifest=json.loads(base64.b64decode(json.loads(signed)['payload']))
      known=set()
      try:
       with urllib.request.urlopen(args.base.rstrip('/')+'/android-update/update.json',timeout=20) as response:
        prior=json.loads(base64.b64decode(json.load(response)['payload']));known={v['sha256'] for v in prior['files'].values()}
      except Exception:pass
      missing={spec['sha256'] for spec in manifest['files'].values()}-known
      for digest in sorted(missing):
       member=next(n for n in archive.namelist() if n.endswith('/blobs/'+digest) or n=='blobs/'+digest)
       data=archive.read(member)
       if hashlib.sha256(data).hexdigest()!=digest:raise RuntimeError('Artifact blob hash mismatch')
       send('admin/api/android-update/blobs/'+digest,data)
      send('admin/api/android-update/publish',signed,'application/json')
      print(json.dumps({'published':'incremental-resources','version':manifest['version'],'changedBlobs':len(missing)}),flush=True)
    completed.add(name)
  if len(completed)==3:return
  time.sleep(15)
 raise RuntimeError('Timed out waiting for verified build artifacts')

if __name__=='__main__':
 try:main()
 except Exception as error:print(type(error).__name__+': '+str(error)[:500],file=sys.stderr);sys.exit(1)


