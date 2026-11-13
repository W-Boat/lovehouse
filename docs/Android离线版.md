# Android 离线版

在 GitHub Actions 的 **Lovehouse Android APK** 构建记录中下载 `lovehouse-android-offline`，解压并安装 `生日小屋-Android.apk`。支持 Android 7.0 及以上，使用设备自带的 Android System WebView。

小屋场景、小游戏、字体、音乐和单人桃源乡随 APK 打包。安装后可在飞行模式游玩，进度保存在应用内。联机时在面板填写可用的 `wss://` 服务器地址。卸载前可通过设置备份小屋存档。

Actions 产物使用临时调试签名供试装。不同构建的签名可能不同，后续覆盖安装需要相同签名。若系统拒绝覆盖安装，先备份，再卸载旧版并安装新版。
