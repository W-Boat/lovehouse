"""Read-only raster inventory and export consistency checks. Never retouches masters."""
from pathlib import Path
from PIL import Image, ImageChops
import ast, json, re

root = Path(__file__).resolve().parents[1]
assets, masters = root/'public/assets', root/'tools/art-source'
tree = ast.parse((root/'tools/prepare_assets.py').read_text(encoding='utf-8-sig'))
sizes = next(ast.literal_eval(node.value) for node in tree.body if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'sizes' for t in node.targets))
runtime = set(re.findall(r"['\"]([^'\"]+\.webp)['\"]", (root/'src/assets.ts').read_text(encoding='utf8')))
runtime|={'loading-cottage.webp','favicon.webp','pet-cat.webp','pet-firefly.webp','pet-star.webp'}
normalized_animations={'gift-opening-v1','tea-pour-v1'}
grids = {'icons-v3':(4,4),'gifts-v3':(2,2),'hero':(4,4),'characters':(4,2),'gifts':(4,3),'props':(4,2),'sitting':(2,2),'girl-actions':(4,4),'boy-actions':(4,4),'girl-walk':(4,4),'boy-walk':(4,4),'icons-v2':(4,4),'gifts-v2':(2,2),'girl-heads':(4,4),'boy-heads':(4,4),'world-actors':(4,4),'wheel-actors':(2,2),'couple-actions':(4,3),'holding-walk-v2':(4,4),'footbath-poses-v2':(3,2),'seats-back':(2,2),'weather-icons-v2':(3,2),'season-views':(4,3),'window-views':(3,3),'interaction-props':(4,4),'gift-opening-v1':(4,4),'tea-pour-v1':(4,4),'sit-transition':(6,2)}
records, errors = [], []
for path in sorted(assets.rglob('*.webp')):
    name = path.relative_to(assets).as_posix()
    row = {'file':name,'runtime':name in runtime or name.startswith('seasons/'),'bytes':path.stat().st_size}
    try:
        with Image.open(path) as decoded:
            decoded.load(); image = decoded.convert('RGBA')
        width, height = image.size
        alpha = image.getchannel('A'); histogram = alpha.histogram(); area = width*height
        row.update(size=[width,height], fullyTransparentPercent=round(histogram[0]/area*100,2), nearOpaquePercent=round(sum(histogram[245:])/area*100,2))
        if name.startswith('seasons/'):
            source = masters/('outdoor-'+path.stem+'.png'); target=(768,512)
        else:
            source=masters/(path.stem+'.png'); target=(768,768) if path.stem=='interaction-props' else sizes.get(path.stem,(768,512))
        if path.stem.startswith('pet-'):
            row['comparison']='normalized pet animation: independent frame export'
        elif source.exists():
            expected=Image.open(source).convert('RGBA'); row['masterSize']=list(expected.size)
            native=row['runtime'] and path.stem not in normalized_animations
            if not native:expected.thumbnail(target,Image.Resampling.NEAREST)
            row['nativeResolutionRestored']=native
            row['retainedLinearResolution']=round(min(width/row['masterSize'][0],height/row['masterSize'][1]),3)
            if path.stem=='interaction-props':
                rgba=bytearray(expected.tobytes())
                for n in range(0,len(rgba),4):
                    if rgba[n+3]<=64:rgba[n:n+4]=bytes(4)
                expected=Image.frombytes('RGBA',expected.size,bytes(rgba))
            if expected.size!=image.size:
                row['comparison']='unexpected export dimensions';errors.append(name+': export dimensions differ')
            else:
                alpha_diff=ImageChops.difference(expected.getchannel('A'),alpha)
                channels=ImageChops.difference(expected.convert('RGB'),image.convert('RGB')).split()
                diff=ImageChops.lighter(ImageChops.lighter(channels[0],channels[1]),channels[2])
                visible=expected.getchannel('A').point(lambda value:255 if value else 0)
                diff=ImageChops.multiply(diff,visible)
                row['visiblePixelDifferences']=area-diff.histogram()[0]
                row['alphaPixelDifferences']=area-alpha_diff.histogram()[0]
                row['comparison']=('exact visible pixels at native resolution' if native else 'exact visible pixels after preserved normalization') if not diff.getbbox() and not alpha_diff.getbbox() else 'export differs from source recipe'
                if row['visiblePixelDifferences'] or row['alphaPixelDifferences']:errors.append(name+': visible export mismatch')
        else:
            row['comparison']='derived asset without matching master filename'
        if path.stem in grids:
            columns,rows=grids[path.stem];cw,ch=width/columns,height/rows
            row['grid']=[columns,rows];row['frameSize']=[round(cw,1),round(ch,1)]
            row['fractionalCellBoundary']=width%columns!=0 or height%rows!=0
            if min(cw,ch)<48:row['note']='small frame: check actual display scale'
            empty=[];opaque=[]
            for i in range(columns*rows):
                cell=alpha.crop((round(i%columns*cw),round(i//columns*ch),round((i%columns+1)*cw),round((i//columns+1)*ch)))
                if not cell.getbbox():empty.append(i)
                if cell.getextrema()[0]>=245:opaque.append(i)
            row['emptyCells']=empty;row['fullyOpaqueCells']=opaque
            if empty and row['runtime']:errors.append(name+': empty sprite cells '+str(empty))
        records.append(row)
    except Exception as exc:
        row['error']=str(exc);records.append(row);errors.append(name+': '+str(exc))
for name in sorted(runtime):
    if not (assets/name).is_file():errors.append(name+': missing referenced image')
report={'scope':'Decoded WebP files, reference existence, export resolution, alpha, visible source/export equality and atlas cells. Art identity and every runtime interaction still require visual acceptance.','assetCount':len(records),'errors':errors,'assets':records}
(root/'docs/visual-asset-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
lines=['# 素材清晰度与异常检查','','范围：当前 public/assets 全部 WebP；检查解码、尺寸、透明通道、图集空帧、引用缺失，以及最终母版按原生分辨率或既定动画规范导出后的可见像素一致性。','',f'共 {len(records)} 张；机器检查异常 {len(errors)} 项。全透明像素的隐藏 RGB 不计作可见失真；生成素材常用 254 alpha，按接近不透明处理。','','| 素材 | 原图 | 导出 | 帧尺寸 | 检查 |','|---|---|---|---|---|']
for r in records:
    if not r['runtime']:continue
    fmt=lambda value:'×'.join(map(str,value)) if value else '—'
    state='通过' if r.get('comparison','').startswith('exact') else r.get('comparison','待复核')
    if r.get('error'):state=r['error']
    lines.append(f"| {r['file']} | {fmt(r.get('masterSize'))} | {fmt(r.get('size'))} | {fmt(r.get('frameSize'))} | {state} |")
lines+=['','## 本次定位','','- 吹蜡烛原来使用 1536×1024 母图坐标裁切已缩到 384×256 的贴图，造成取样越界；现按实际图片尺寸和归一化标注取样。','- 烟花原来对 768×512 背景请求 1536×700 源区域，浏览器按有效源区域裁掉部分目标画面；现按实际尺寸计算 cover 裁切，覆盖完整画布。','- 去除固定 240px 画布高度下限，超宽屏保持与可视区域相同的比例；蛋糕从新版高清母图原生导出，五根烛芯与动态火焰分离。','- 当前启用的原图型素材已恢复最终母版的原生分辨率，无损转为 WebP；16帧交互动画与规范化宠物保留现有帧规格、清理和时序。历史未启用版本保留参考，不回退使用。','- 图标和礼物母图存在串格碎片的问题已用 ImageGen v3 重新整理排布；双人和耳机合成统一关闭平滑。数值一致不能替代人物、座位和手部姿态的实际检查。']
if errors:lines+=['','## 机器发现的异常']+['- '+error for error in errors]
(root/'docs/素材清晰度检测.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
print(json.dumps({'assetCount':len(records),'errors':errors},ensure_ascii=False))
raise SystemExit(1 if errors else 0)
