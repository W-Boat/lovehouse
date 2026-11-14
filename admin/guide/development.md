# 主要开发方法

## 初始化

```powershell
git clone https://github.com/W-Boat/lovehouse.git
Set-Location lovehouse
npm ci
python -m pip install pillow fonttools brotli
npm run dev
```

发布前的常规检查是 `npm run build` 与 `npm test`。需要浏览器验收时，先 `npx playwright install chromium firefox webkit`，再 `npx vite build --mode e2e` 和 `npm run test:e2e`。按用户指定的范围执行。

## 新增云端场景或互动

1. 通过 CLI 拉取线上快照。用 CLI 上传 WebP 等背景资源并记录返回地址。
2. 在 `scenes` 添加 `id`、`parent`、`name`、`caption`、`background`、`entrance`、`spawn`、`exit`、`floor`。画面坐标以 640 × 426 为基准。新场景 ID 使用 `cloud-` 前缀，父场景必须为已有内置区域。落脚点、出生点和出口要在可达范围。
3. 如需互动，在 `interactions` 配置独立 ID、`zone`、名称、动作、坐标、落脚点和反馈。外部小游戏走 `gameUrl`，普通网页走 `url`。遵循共享校验器 `content/cloud-interactions.mjs` 的互斥规则。
4. 运行 `check`，再以原修订执行 `push`。重新 `pull` 确认线上修订。游戏重进后检查加载提示、地图入口、点击落脚点和返回路线。写入 HANDOFF.md。

## 新增内置场景或修改游戏体验

1. 修改 `src/world.ts` 定义场景与入口，加入 `public/assets/` 素材，并更新 `src/assets.ts`。需要坐姿、动作、遮挡或受限地形时，修改 `layouts.ts`、`navigation.ts` 和对应效果模块。共享拾取、装备和存档行为沿现有接口接入。
2. 修改 `content/` 中的文案源。需要交付可替换文案时，运行 `node --import tsx tools/export-content.ts`，并复核导出与当前稳定 ID。
3. 运行 `npm run build` 与 `npm test`。验证首次及再次进入、触屏操作、场景切换和存档。更新包内素材或配置时，从根目录执行 `node --import tsx tools/export-bundled-catalog.ts`，部署时同步真实素材目录。

## 新增后台功能

1. 业务页面放在 `admin/`，从 `AdminLayout.vue` 和 `App.vue` 接入导航。使用现有授权与草稿流程。
2. 读取或写入端点在 `tools/cloud-content.mjs` 处理。云端字段变更同时更新共享校验、快照生成和客户端读取；发布修订计算须兼容旧快照。
3. 运行 `npm ci --prefix admin`。生产前缀由 `LOVEHOUSE_PUBLIC_PREFIX` 传入，PowerShell 运行 `$env:LOVEHOUSE_PUBLIC_PREFIX='/lovehouse'; npm run build --prefix admin`。
4. 验证读取、校验、发布、版本冲突和回退。按发布指南部署后访问公网后台，确认静态资源路径、API 鉴权和实际功能。记录版本与回滚方式。
