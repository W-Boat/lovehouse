# 发布 Agent 操作手册

使用 Node 22。通过进程环境变量 `LOVEHOUSE_ADMIN_TOKEN` 注入凭证。

```sh
node tools/cloud-content.mjs upload ./scene.webp https://server.080726.xyz/lovehouse/
node tools/cloud-content.mjs check ./draft.json
node tools/cloud-content.mjs publish ./draft.json ./content.json
```

上传返回 JSON，取 `asset.url` 填入草稿。相同文件按内容哈希复用。校验返回修订号；`publish` 命令生成可交付的配置文件。

要更新服务端线上配置，带 `Authorization: Bearer <token>` 请求 `GET /admin/api/snapshot` 获取版本，在完整草稿上修改，再向 `POST /admin/api/check` 和 `POST /admin/api/publish` 提交 JSON。发布带 `If-Match: "<revision>"`。初次发布使用空引号 `If-Match: ""`。收到 412 时重新读取并合并。

素材可通过 `GET /admin/api/assets` 列出。上传也可直接调用 `POST /admin/api/assets`，请求体为原始字节，`X-Asset-Name` 为百分号编码的文件名。返回的 `asset.path` 可相对于服务器地址拼接。删除用 `DELETE /admin/api/assets/<id>`。收到 409 时检查已发布配置的引用。

当前线上 API 使用 `/lovehouse/admin/api/` 前缀；上文 API 路径相对于发布服务基地址。
