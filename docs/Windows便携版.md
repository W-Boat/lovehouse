# Windows 便携版

本项目不在本地部署。Windows 10/11 x64 客户端由 GitHub Actions 构建。
下载工作流中的 lovehouse-windows-x64-portable，解压后运行 lovehouse.exe。游戏资源内置，无需运行网页服务器。

依赖系统 Microsoft Edge WebView2，不捆绑浏览器。如电脑缺少 WebView2，请从微软官网安装 Evergreen Runtime。
可写目录会创建 lovehouse-data 保存进度。只读目录会回退系统数据目录并提示；可复制到可写目录使用便携存储，或在设置里导出存档。
当前构件未签名。网页与客户端可通过存档文件互相迁移。
