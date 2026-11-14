# 架构与模块

| 职责 | 入口与主要模块 |
| --- | --- |
| 游戏启动 | `index.html`、`src/bootstrap.ts`、`src/main.ts`。启动时读云配置，再初始化 Phaser 和 UI。 |
| 云配置 | `src/cloud-content.ts` 校验修订与复用缓存，`src/cloud-background.ts` 加载场景图，`content/cloud-*.mjs` 提供发布与客户端共用字段校验。 |
| 场景与角色 | `src/world.ts`、`src/scene.ts`、`src/layouts.ts`、`src/navigation.ts`、`src/actors.ts`。地图、动作和遮挡分别沿 `round-minimap.ts`、`world-motion.ts`、`seat-layers.ts`。 |
| 文案、礼物与小游戏 | `content/`、`src/rewards.ts`、`src/minigames.ts`、`src/side-games.ts`。内置素材在 `public/`，存档与拾取状态在 `src/state.ts`。 |
| 联机 | `src/online-client.ts` 处理连接，`online-world.ts` 接管双人角色状态，`online-protocol.ts` 定义协议。独立 WebSocket 服务入口是 `server/index.mjs`，房间逻辑与答题分别在 `server/rooms.mjs`、`server/quiz.mjs`。 |
| 后台 UI | `admin/src.js`、`admin/App.vue`、`AdminLayout.vue`。Naive UI 提供主布局与部分页面，其他表单仍有 Element Plus。业务页面含素材、历史、安装包和 Android 资源更新。 |
| 发布服务 | `tools/cloud-content.mjs` 提供 HTTP 和 CLI，`cloud-assets.mjs`、`cloud-bundled.mjs`、`cloud-packages.mjs`、`cloud-android-update.mjs` 和 `cloud-stats.mjs` 分别负责素材、内置目录、安装包、增量和统计。 |
| 壳与资源 | `android/` 为 WebView 客户端，`src-tauri/` 为 Windows 壳，`src/content-updates.ts` 对接启动检查及平台入口。 |

默认公网前缀为 `/lovehouse`。内容服务默认监听 `127.0.0.1:8789`，WebSocket 生产代理转发到 `127.0.0.1:8787`。发布快照及资源目录与服务代码分别保存。素材库的内置资源预览依赖目录清单与实际素材路径。
