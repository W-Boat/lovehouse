"""Generate a read-only original/export comparison page; image files are never modified."""
from pathlib import Path
import json, html
root=Path(__file__).resolve().parents[1]
report=json.loads((root/'docs/visual-asset-report.json').read_text(encoding='utf8'))
cards=[]
for item in report['assets']:
    name=item['file'];stem=Path(name).stem
    master=('outdoor-'+stem if name.startswith('seasons/') else stem)+'.png'
    source=root/'tools/art-source'/master
    original=f'<img loading="lazy" src="../tools/art-source/{html.escape(master)}" alt="{html.escape(name)} 原图">' if source.exists() else '<p>独立派生素材，参见来源清单</p>'
    category='四季昼夜' if name.startswith('seasons/') else '图集' if item.get('grid') else '背景与独立素材'
    dimensions=' × '.join(map(str,item['size']))
    master_size=' × '.join(map(str,item.get('masterSize',[]))) or '独立规范化'
    note=f"每帧 {item['frameSize']}；边界舍入 {item['fractionalCellBoundary']}" if item.get('grid') else ''
    cards.append(f'<article data-kind="{category}"><h2>{html.escape(name)}</h2><p>{'当前启用' if item['runtime'] else '历史保留，当前未启用'} · {category} · 原图 {master_size} → 导出 {dimensions}</p><div class="pair"><figure>{original}<figcaption>母图</figcaption></figure><figure><img loading="lazy" src="../public/assets/{html.escape(name)}" alt="导出 {html.escape(name)}"><figcaption>当前发布素材</figcaption></figure></div><small>{html.escape(note)}</small></article>')
page='''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>素材原图与导出对照</title><style>
body{margin:0;background:#22262d;color:#efe7d6;font:15px system-ui}header{position:sticky;top:0;z-index:2;padding:16px;background:#272d35f5;border-bottom:1px solid #716758}h1{font-size:22px;margin:0 0 10px}button{min-height:44px;padding:6px 14px;margin:4px;background:#e9d4b2;border:0;color:#312b28}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(480px,1fr));gap:16px;padding:16px}article{padding:12px;background:#30363d;border:1px solid #6c655b;break-inside:avoid}h2{font-size:16px;overflow-wrap:anywhere}.pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}figure{margin:0;min-width:0;background:repeating-conic-gradient(#42474e 0 25%,#353a41 0 50%) 0/16px 16px}img{width:100%;height:220px;object-fit:contain;image-rendering:pixelated;display:block}figcaption{padding:6px;background:#242a30}small{display:block;margin-top:10px;color:#d0c2a5}.large main{grid-template-columns:1fr}.large img{height:auto;max-height:800px}.hidden{display:none}p{line-height:1.5}@media(max-width:520px){main{grid-template-columns:1fr}.pair{grid-template-columns:1fr}}
</style><header><h1>全量素材原图 / 发布图对照</h1><p>本页包含全部 WebP；需在完整源码的 docs 目录中打开。最近邻显示，点击放大核对细线、轮廓、帧边缘与透明背景。能够解码或像素一致不代表美术已通过人工验收。</p><button data-filter="">全部</button><button data-filter="背景与独立素材">背景与独立素材</button><button data-filter="图集">角色 / 礼物 / 道具 / 图标图集</button><button data-filter="四季昼夜">四季昼夜</button><button id="zoom">切换大图</button></header><main>'''+''.join(cards)+'''</main><script>document.querySelectorAll('[data-filter]').forEach(button=>button.onclick=()=>document.querySelectorAll('article').forEach(card=>card.classList.toggle('hidden',Boolean(button.dataset.filter)&&card.dataset.kind!==button.dataset.filter)));document.getElementById('zoom').onclick=()=>document.body.classList.toggle('large');</script>'''
(root/'docs/素材原图与导出对照.html').write_text(page,encoding='utf8')
print('Read-only comparison gallery:',len(cards),'assets')
