# 发布 CLI

CLI 源码随仓库维护，入口为 `tools/cloud-content.mjs`。技能包的封装脚本使用 Node 22，按当前工作目录解释输入输出路径，自动为线上命令填入 `.ENV` 中的 HTTPS 基地址。执行前可从技能目录使用下列命令。也可设置 `LOVEHOUSE_ENV_FILE` 指向另外一份本地配置。

```powershell
Copy-Item .ENV.example .ENV
node scripts/lovehouse-cli.mjs pull before.json
node scripts/lovehouse-cli.mjs upload test-cottage.webp
node scripts/lovehouse-cli.mjs check draft.json
node scripts/lovehouse-cli.mjs push draft.json <before.json中的revision>
node scripts/lovehouse-cli.mjs pull after.json
```

把上传返回的 `asset.url` 填进草稿对应字段。保留 `before.json` 和线上返回的修订号。HTTP 412 表示发布基准变化，重新拉取后把目标字段合并到新草稿。首次发布可传 `new`。`publish INPUT OUTPUT` 在本机校验并生成修订快照，`serve SNAPSHOT` 启动本机内容服务，`history SNAPSHOT` 读取该本地快照的历史。

从仓库根目录也可直接运行原生 CLI：

```powershell
node --env-file=C:/private/lovehouse.ENV tools/cloud-content.mjs pull https://server.080726.xyz/lovehouse/ before.json
node --env-file=C:/private/lovehouse.ENV tools/cloud-content.mjs push draft.json https://server.080726.xyz/lovehouse/ REVISION
node tools/cloud-content.mjs check draft.json
node tools/cloud-content.mjs publish draft.json snapshot.json
```

公开读取端点为 `content.json`、`packages.json` 和 `android-update/update.json`。发布 API 位于 `admin/api/`，认证用 Bearer。文案采用稳定 ID，包内基线可由后台查看，云端仅下发覆盖项。场景与外部小游戏的地址用 HTTPS，场景背景要能被客户端跨域获取。完整字段见仓库 `docs/云端内容配置.md` 和 `content/cloud-*.mjs`。

回滚内容可在后台「发布历史」选择修订号并以当前修订为基准确认；也可把保存的旧草稿通过 CLI 重新推送。安装包切换走「安装包」历史，不会同时变更内容快照。
