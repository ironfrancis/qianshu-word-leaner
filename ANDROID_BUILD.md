# English Typing Practice - Android APP

使用 Capacitor 将打字练习应用打包成 Android APP。

## 项目结构

```
english-typing-practice/
├── www/                    # Web 应用源文件（打包到 APP）
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── sounds/
├── android/                # Android 原生项目
├── capacitor.config.json    # Capacitor 配置
└── package.json            # npm 依赖配置
```

## 开发工作流

### 1. 修改 Web 代码

在 `www/` 目录中修改 HTML/CSS/JS 文件。

### 2. 同步到 Android

```bash
npm run cap:sync
```

### 3. 打开 Android Studio

```bash
npm run cap:open:android
```

### 4. 在 Android Studio 中

1. 等待 Gradle 同步完成
2. 点击 "Run" 按钮或按 `Shift + F10`
3. 选择连接的 Android 设备或模拟器

## 快速命令

```bash
# 同步 Web 文件到 Android
npm run cap:sync

# 打开 Android Studio
npm run cap:open:android

# 直接运行到设备（需要连接设备或启动模拟器）
npm run cap:run:android
```

## 功能说明

完整功能包括：
- 艾宾浩斯记忆曲线
- 学习/复习/错题模式
- 机械键盘音效
- 单词发音（有道词典 API）
- 输入错误立即重置
- 本地存储学习进度

## 注意事项

1. **网络权限**：应用需要网络权限来加载单词发音
2. **本地存储**：学习进度保存在应用本地
3. **音效文件**：已打包到应用中，无需网络

## 构建发布版 APK

在 Android Studio 中：
1. Build -> Generate Signed Bundle / APK
2. 选择 APK
3. 创建或使用现有签名密钥
4. 选择 "release" 构建类型
5. 生成的 APK 位于 `android/app/release/`

## 系统要求

- Android 5.0 (API 21) 或更高版本
- Node.js 16+
- Android Studio（用于构建和调试）
