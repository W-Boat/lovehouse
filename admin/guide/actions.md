# GitHub Actions 与发布

在 GitHub 仓库 `W-Boat/lovehouse` 上用已授权的分支和提交启动构建。以下命令使用 GitHub CLI 登录态。没有 `gh` 时，仓库的 `tools/github_ci.py` 提供 auth、status、download 和 logs。

```powershell
gh workflow run android.yml --ref main -f defer_acceptance=true
gh workflow run build.yml --ref main -f windows_only=true
gh run watch RUN_ID --exit-status
gh run download RUN_ID -n lovehouse-android-offline -D delivery/android
gh run download RUN_ID -n lovehouse-windows-x64-portable -D delivery/windows
```

| 工作流 | 构件 |
| --- | --- |
| `build.yml` | `lovehouse-web-and-checks`、`lovehouse-publisher`、`lovehouse-windows-x64-portable`。`windows_only=true` 只构建 Windows。 |
| `android.yml` | `lovehouse-android-offline` 和签名的 `lovehouse-content-update`。增量版本来自 Actions run number。 |
| `visual-assets.yml` | 蜡烛和素材诊断，构件 `candle-and-asset-diagnostics`。 |
| `interaction-checks.yml` | 互动与缩放诊断，构件 `tea-and-scaling-checks`。 |

`LOVEHOUSE_CONTENT_SERVER` 是 Actions variable。Android 签名使用 `ANDROID_KEYSTORE_BASE64` 与 `ANDROID_KEYSTORE_PASSWORD`，存入 Actions secrets。Android 使用 APK 和签名校验文件，Windows 保留便携 ZIP 与构建来源。检查构件对应预期提交与 SHA-256 后，在后台「安装包」分别上传并确认公网 `packages.json`。CLI 下载的 Windows 构件要按交付要求保留 EXE 和说明。Android 增量走 `tools/publish_android_update.py DIRECTORY HTTPS_BASE`，上传内容目录中的更新清单和分块，待签名与所有块验证后启用。APK、增量清单和内容快照独立发布。

## 后台部署与回滚

1. 按实际公网前缀构建 `admin/dist`。准备 `tools/cloud-*.mjs`、`content/cloud-*.mjs`、`admin/bundled/catalog.json` 和实际 `public/`，或把 `LOVEHOUSE_BUNDLED_PUBLIC_DIR` 指向同一版本的资源目录。Actions 的 publisher 构件当前需要补入目录清单及实际素材。
2. 用本地 `.ENV` 中的部署位置与 SSH 身份连接。发布服务及联机服务分别部署，保留上一份应用目录和运行数据。服务端私密配置按部署机已有的密钥存放方式管理。更新包仅替换本次改变的组件，再重启受影响的服务。
3. 公网验证后台可登录、`content.json` 返回修订、素材可实际预览、`packages.json` 指向发布版本。改动联机服务时，核对 WebSocket 并用两个会话走一次入房及互动。
4. 后台应用故障时恢复前一份应用目录并重启。内容修订通过发布历史回滚，安装包通过安装包历史切换。分别记录回滚后的版本。
