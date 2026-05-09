# TinyMD

TinyMD 是一个面向 Android 手机的轻量级 Markdown 工作区，适合随手记录、阅读文档、整理笔记和快速导出内容。

当前成品版本：`1.1.0`

## 功能特点

- 导入本地 `.md` 文档
- 最近文件列表 / 窗口两种浏览方式
- 阅读模式与源码编辑模式切换
- 长按最近文件进行重命名或删除
- 导出为 `.md` 或 PDF
- 浅色 / 夜间 / Sepia 三种主题
- 适配 Android 10+、64 位设备

## 界面说明

- `最近`
  - 查看最近打开或创建的 Markdown 文档
  - 支持搜索、列表模式、窗口模式
- `编辑`
  - 提供正文 / 源码切换
  - 支持常用 Markdown 快捷插入
- `阅读`
  - 以清爽排版查看 Markdown 文档
  - 支持标题、列表、引用、代码块、表格、链接、分割线等样式
- `设置`
  - 切换主题模式
  - 查看当前版本更新日志

## 默认内置文档

首次打开应用时，内置一份：

- `TinyMD使用指南.md`

这份文档会介绍软件用途、基本操作，以及常见 Markdown 样式展示。

## 技术栈

- React Native
- Expo
- TypeScript
- Android 原生工程（已生成）

## 本地运行

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm start
```

运行 Android 调试：

```bash
npm run android
```

## 打包 Release APK

项目根目录提供了一键打包脚本：

- `build-release.bat`
- `build-release.ps1`

双击 `build-release.bat`，或执行：

```bash
npm run release:apk
```

打包完成后，APK 会出现在：

- `android/app/build/outputs/apk/release/app-release.apk`
- `release-apk/TinyMD-1.1.0-release.apk`

## 项目结构

```text
TinyMD/
├─ src/                  # 组件、主题、类型、默认文档
├─ android/              # Android 原生工程
├─ App.tsx               # 应用主入口
├─ app.json              # Expo 配置
├─ icon.png              # 应用图标
├─ build-release.bat     # 一键打包脚本
└─ build-release.ps1     # Release 打包脚本
```

## 适用场景

- 手机上快速阅读 Markdown
- 随手记笔记或草稿
- 管理轻量文档和清单
- 导出分享给他人
