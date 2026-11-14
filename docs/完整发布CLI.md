# 完整发布 CLI

Node 22，执行 node tools/cloud-cli.mjs help。默认读取当前目录 .ENV，也可 --env 指定。配置 LOVEHOUSE_CONTENT_SERVER 和 LOVEHOUSE_ADMIN_TOKEN，或使用 --token-file。命令输出 JSON。所有后台能力通过同一组 API 实现，认证和并发校验与后台一致。

| 操作 | 命令 |
| --- | --- |
| 当前配置 | snapshot --output current.json |
| 全部内置配置和素材 | catalog |
| 在线统计 | stats |
| 素材列表、上传 | assets、upload FILE |
| 素材引用、删除 | asset-refs ID、asset-delete ID |
| 本地校验 | check draft.json |
| 发布全部配置 | publish draft.json --if-match CURRENT_REVISION |
| 发布历史 | history、history-show REVISION |
| 回滚 | rollback TARGET_REVISION --if-match CURRENT_REVISION |
| 安装包历史 | packages |
| 安装包上传 | package-upload android VERSION FILE.apk 或 package-upload windows VERSION FILE.zip |
| 历史安装包切换 | package-select selection.json --if-match CURRENT_PATH |
| 签名资源清单 | update-manifest |
| 增量资源发布 | android-publish DIRECTORY |
| 其他全部 API | request METHOD admin/api/PATH --file input.json |

selection.json 按 API 填 platform 和 path，参见 packages 输出。通用 request 可以调用后台账号登录、退出和修改密码。登录后会话字符串可临时放入 LOVEHOUSE_ADMIN_TOKEN；修改密码接口需要账号会话。使用 shell 环境注入密码和令牌，避免把秘密写进命令历史。

发布包含文案、场景、动画图层、互动、礼物、小游戏、网页入口、歌单、媒体、资源清单、游戏私告、系统通知和统计开关。先读取现有配置，在完整配置上修改，再以读取的 revision 发布。用户有其他未发布草稿时保持线上版本的乐观锁。上传素材返回不可变哈希 URL，后台和 CLI 可互相读取和继续编辑。

HTML 可直接上传并绑定沙盒网页或小游戏入口。ZIP 作为文件下载与预缓存，当前不会自动解压成可执行网页。多文件 HTML 应先提供可访问的资源链接，或使用后续原生版本打包。

CLI Skill 下载在后台项目文档页。开工先读 Agent.MD，每次交付更新 HANDOFF.md。

定时开放用 `opening-get` 查看，用 `opening-set rules.json` 保存。规则文件包含 `enabled`、ISO 8601 格式的 `opensAt` 和 `allowIps` 数组。开放规则立即生效，独立于内容草稿和版本回滚。IP 白名单只在鉴权后的后台和 CLI 可见。

GitHub runner 能直连发布服务器时，可在仓库变量中设置 `LOVEHOUSE_DIRECT_PUBLISH=true`。当前部署可以在能同时访问 GitHub 和发布服务器的电脑上运行 `python tools/actions_release_relay.py --sha 完整提交号 --token-file 本机令牌文件`。工具等待该提交的构件，分段读取并发布 Android、Windows 与签名资源更新。令牌从本机文件读取。

安装包可用 `package-direct android VERSION FILE.apk` 或 `package-direct windows VERSION FILE.zip` 直传私有储存桶。配置、网络要求和校验方式见 [对象存储](对象存储.md)。

安卓独立桶：android-bucket-get、android-bucket-test connection.json、android-bucket-set connection.json。服务器仅签名模式参见《对象存储》，package-direct 会在本机完整读回校验后发布。
