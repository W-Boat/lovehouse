import sys, os, json, hashlib, http.client, time
from pathlib import Path
from urllib.parse import urlsplit, urlencode
platform,version,filename=sys.argv[1:]
f=Path(filename)
base=urlsplit(os.getenv('LOVEHOUSE_CONTENT_SERVER') or 'https://server.080726.xyz/lovehouse/')
assert base.scheme=='https'
token=os.environ['LOVEHOUSE_PUBLISHER_TOKEN']
assert token
sha=hashlib.sha256(f.read_bytes()).hexdigest()
for attempt in range(3):
 try:
  conn=http.client.HTTPSConnection(base.hostname,base.port or 443,timeout=300)
  path=base.path.rstrip('/')+'/admin/api/packages?'+urlencode({'platform':platform,'version':version})
  conn.putrequest('POST',path)
  conn.putheader('Authorization','Bearer '+token)
  conn.putheader('Content-Type','application/octet-stream')
  conn.putheader('Content-Length',str(f.stat().st_size))
  conn.endheaders()
  with f.open('rb') as stream:
   while chunk:=stream.read(1024*1024):conn.send(chunk)
  response=conn.getresponse();data=json.loads(response.read())
  if response.status not in (200,201):raise RuntimeError(str(response.status)+' '+str(data))
  entry=data.get('entry',data.get('package',data))
  assert entry.get('sha256')==sha, data
  print(json.dumps({'platform':platform,'version':version,'sha256':sha,'published':True}))
  break
 except Exception:
  if attempt==2:raise
  time.sleep(5)
