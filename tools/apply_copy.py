import re,json,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1];src=Path(sys.argv[1]) if len(sys.argv)>1 else root/'文案.md'
p=root/'content/personal.json';config=json.loads(p.read_text(encoding='utf8'));text=src.read_text(encoding='utf-8-sig');matches=re.findall(r'<!-- copy:([a-z0-9.-]+) -->\s*([\s\S]*?)\s*<!-- /copy:\1 -->',text)
if not matches:raise SystemExit('No copy sections found')
config['texts'].update({key:value for key,value in matches});p.write_text(json.dumps(config,ensure_ascii=False,indent=2),encoding='utf8');print('Applied',len(matches),'copy sections; rebuild regenerates font subset')
