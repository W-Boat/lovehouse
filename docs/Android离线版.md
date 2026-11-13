# Android 离线版

在 GitHub Actions 的 **Lovehouse Android APK** 构建记录中下载 `lovehouse-android-offline`，解压并安装 `生日小屋-Android.apk`。支持 Android 7.0 及以上，使用设备自带的 Android System WebView。

小屋场景、小游戏、字体、音乐和单人桃源乡随 APK 打包。安装后可在飞行模式游玩，进度保存在应用内。联机时在面板填写可用的 `wss://` 服务器地址。卸载前可通过设置备份小屋存档。

新构建使用固定正式签名，证书指纹见 android-signing-cert.sha256，版本号随 Actions 构建递增。以后可用同签名的新 APK 覆盖升级并保留应用内进度。首次从旧调试版迁移到正式签名版时，先在设置导出存档，再卸载旧版、安装正式签名版并导入。

密钥通过 Actions Secrets 注入，私钥备份保存在维护者本机仓库外，发布包包含公钥证书指纹。图片和存档使用系统文件选择器导出，取消后可重新操作。实际手机上的导出和升级仍待验收。
