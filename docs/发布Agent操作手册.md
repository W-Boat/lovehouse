# 发布 Agent 操作手册

使用 Node 22。发布基地址为 `https://server.080726.xyz/lovehouse/`。通过进程环境变量 `LOVEHOUSE_ADMIN_TOKEN` 注入凭证。凭证不放进 URL、草稿、日志或源码。

## CLI

```sh
node tools/cloud-content.mjs upload ./scene.webp https://server.080726.xyz/lovehouse/
node tools/cloud-content.mjs check ./draft.json
node tools/cloud-content.mjs publish ./draft.json ./content.json
node tools/cloud-content.mjs history ./content.json
```

`upload` 调用远端接口并返回 JSON，取 `asset.url` 填入草稿。相同字节内容按哈希复用。`check` 离线校验草稿并返回修订号。`publish` 写入本地指定文件，同时保留历史，不会主动推送远端。`history` 列出指定本地发布文件的历史。命令失败向 stderr 输出 JSON 错误并返回非零退出码。

## 远端 API

以下路径均相对于发布基地址，线上完整前缀为 `/lovehouse/admin/api/`。请求带 `Authorization: Bearer <token>`，JSON 请求带 `Content-Type: application/json`。

|操作|方法与路径|返回或请求内容|
|---|---|---|
|读取当前发布|`GET admin/api/snapshot`|完整快照，含 `revision`；尚未发布时为空对象|
|校验草稿|`POST admin/api/check`|提交完整草稿，返回 `{revision}`|
|发布草稿|`POST admin/api/publish`|提交完整草稿，返回 `{revision}`|
|历史列表|`GET admin/api/history`|`{revisions:[{revision,createdAt,bytes,current}]}`|
|读取某个修订|`GET admin/api/history/<revision>`|完整快照|
|回滚|`POST admin/api/rollback`|请求 `{revision:"目标修订号"}`，返回 `{revision}`|
|素材列表|`GET admin/api/assets`|`{assets:[{id,name,mime,bytes,path}]}`|
|上传素材|`POST admin/api/assets`|原始文件字节，返回 `{asset}`|
|删除素材|`DELETE admin/api/assets/<id>`|返回 `{deleted:id}`|

编辑流程先读取当前快照并保留它的修订号，再在副本上改动并校验。发布带 `If-Match: "<当前 revision>"`，初次发布使用空引号 `If-Match: ""`。服务端发布 API 接受此条件，Agent 每次发布都应发送，避免覆盖并行编辑。收到 412 时重新读取并合并。

回滚必须带当前版本的 `If-Match`，缺少时返回 428，冲突时返回 412。目标修订必须来自当前服务保留的历史，找不到返回 404。回滚前后的版本均保留；重复恢复当前版本可返回成功。读取历史并导入草稿与回滚是两个独立操作。

上传设置 `X-Asset-Name` 为百分号编码的文件名。类型由文件内容与扩展名共同验证，支持 PNG、JPEG、WebP、AVIF、MP3、WAV、OGG、M4A 和 LRC。单文件上限 16 MiB，LRC 上限 512 KiB。返回的 `asset.path` 是包含部署前缀的站点绝对路径，使用 `new URL(asset.path, base)` 拼成完整地址；CLI 已额外返回 `asset.url`。当前快照或保留历史引用的素材删除返回 409，需保留该资源用于历史恢复。

浏览器后台的本机草稿不自动同步给 Agent。协作时通过导出 JSON 传递草稿，或从发布 API 读取已发布版本。配置格式与场景、小游戏约束见 `docs/云端内容配置.md`。

Agent 可用 `node tools/cloud-content.mjs pull https://server.080726.xyz/lovehouse/ current.json` 读取线上配置并保存到文件。编辑后用 `node tools/cloud-content.mjs push current.json https://server.080726.xyz/lovehouse/ <读取时的revision>` 条件发布。初次无配置使用 `new`。返回 412 时重新读取并合并，避免覆盖他人修改。已通过线上拉取和同内容条件发布试验。
