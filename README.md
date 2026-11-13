# 生日小屋 2.0

二十四个区域、十二份礼物及独立小游戏，两个人的像素探索小世界。

## 交付方式

**不在本地部署。** GitHub Actions 执行网页构建、Chrome / Firefox / WebKit 验收，再构建 Windows x64 免安装客户端。

工作流构件：
- lovehouse-web-and-checks：静态网页 dist、截图与验收报告、可替换文案。
- lovehouse-windows-x64-portable：内置网页资源的 lovehouse.exe，依赖系统 WebView2，无需运行服务器。

可将网页 dist 上传到你选择的静态托管平台。本项目不会自动发布私人生日内容。

## 替换内容

先阅读 `需替换内容.md`，在 `文案.md` 的 copy 标记之间填入文字。运行 `python tools/apply_copy.py 文案.md` 应用到配置，再提交到 GitHub 触发构建。字体会重新子集化。
素材选项在 content/personal.json：出生日期、月相、真实礼物外观、回忆照片、演唱会音频。路径相对 public，例如 audio/concert.m4a。

## 离线检查与构建

Node.js 22、Python 3.12+；`pip install pillow fonttools brotli`，`npm ci`。
`npm run build` 只生成静态文件，`npm test` 运行离线测试。浏览器测试只允许在 CI 运行。

## 游戏操作

点击物件自动走近；WASD / 方向键移动，E 互动，Escape 取消动作或关闭面板。手机使用摇杆与互动按钮。第一次点击进入时请求全屏和音频；不支持时仍可正常游玩。

世界地图展示区域和路线。到访后的区域可快速旅行；新区域先沿路探索。每份礼物对应独立小游戏，可跳过，领取后从礼物详情重玩。

猫猫小屋从玻璃花房进入。团团会对摸猫、喂食和逗猫棒作出反应，窗边有双人长椅，还能合影和留言。

## 数据

进度只在当前浏览器或客户端保存；支持 v1 迁移、导入、导出。联机为可选模式。连接后，双人互动会通过所选服务器同步，相关设置见 docs/联机服务端.md。

## 验收

详见 docs/验收报告.md、docs/41项需求对应表.md、docs/素材来源.md。桌面浏览器自动化与手机尺寸模拟不等同于实体手机验收；实机测试状态会明确标注。


某平一高从遂平·嵖岈山进入；主房间新增团团宠物和唱片房入口。唱片房接入 HeoMusic 的 APlayer/Meting 内核，支持歌单设置、真实封面和地面 LRC 投影。配置见 `content/music-room.json`，说明见 `docs/校园、猫猫与唱片房.md`。本轮新增内容按要求延后浏览器和实机验收。
