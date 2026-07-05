# 🌳 千树背单词 (Qianshu Word Learner)

> **父与子的编程之旅** — 一个在键盘上种下单词树的交互式英语学习工具。

千树背单词是一个基于 **艾宾浩斯遗忘曲线** 的英语单词打字练习应用。它将"看中文→打英文"的主动回忆机制与科学的复习间隔算法相结合，帮助小学阶段的英语学习者（以及任何想巩固基础词汇的人）在键盘上高效积累单词。

> 📖 **项目起源**：这是千树学习 JavaScript 的第一个开源项目，由父子共同编程完成。代码即是学习笔记。

---

## ✨ 功能亮点

| 功能 | 说明 |
|------|------|
| 🎯 **打字即学习** | 显示中文释义，键盘输入对应英文单词，输入即练习 |
| 🧠 **艾宾浩斯记忆曲线** | 8 级科学复习间隔（5分钟 → 15天），符合遗忘规律 |
| 📊 **学习统计** | 实时显示进度、正确率、连续正确数 |
| ❌ **智能错题本** | 自动记录错误单词，在复习位优先出现 |
| 💡 **智能提示系统** | 无输入 8 秒后逐步提示字母，30 秒展示完整学习卡 |
| 🆕 **新单词学习模式** | 首次遇到新单词自动先展示答案学习 3 秒 |
| 📦 **两档练习模式** | 小试牛刀（固定 20 词/轮）与挑战模式（无限续练） |
| 📚 **多词包支持** | 内置小学英语词包 + 计算机兴趣词包，可扩展 |
| 🔁 **自动进度保存** | 学习进度自动持久化到浏览器 localStorage |
| 🌙 **深色模式** | 支持明/暗主题切换 |
| 🔊 **发音 & 音效** | 有道词典发音 API + 机械键盘打字音效 |
| 📱 **Android 支持** | 通过 Capacitor 打包为原生 Android APP |

---

## 🚀 快速开始

> ⚠️ 本项目通过 `fetch` 加载 XML 词库，**必须经由本地 HTTP 服务器访问**，直接用 `file://` 打开 `index.html` 会导致词库加载失败。

### 方式一：VS Code / Cursor Live Server（推荐）

```bash
git clone https://github.com/ironfrancis/qianshu-word-leaner.git
cd qianshu-word-leaner
# 在 index.html 上右键 → 「Open with Live Server」
```

### 方式二：Python HTTP 服务器

```bash
cd qianshu-word-leaner
python -m http.server 8000
# 浏览器访问 http://localhost:8000
```

### 方式三：Node.js 服务器

```bash
npx serve .
# 浏览器访问 http://localhost:3000
```

### 方式四：Android APP（Capacitor 打包）

详见 [ANDROID_BUILD.md](./ANDROID_BUILD.md)。

---

## 🎮 使用指南

### 选择词包

| 词包 | 单词数 | 说明 |
|------|--------|------|
| 📗 **小学英语全部** | 448 词 | 覆盖小学阶段核心词汇 |
| 💻 **计算机兴趣词包** | ~260 词 | 编程相关的计算机术语 |

### 练习档位

**小试牛刀**（推荐日常使用）
- 每轮目标 20 个单词
- 自动混合：到期复习词 + 新词 + 错题加权词
- 一轮完成即结束，适合碎片时间

**挑战模式**（适合深入学习）
- 每批 20 个单词，练完自动续下一批
- 可随时点击「结束练习」查看统计

### Feed 排词策略（V2 动态配比）

每批默认 **20 词**，系统根据当前词池压力动态决定复习/新词目标：

| 复习压力 | 复习词 | 新词 |
|:--------:|:------:|:----:|
| 高 | 14 | 6 |
| 中（默认） | 12 | 8 |
| 低 | 8 | 12 |
| 无到期复习 | 0 | 20 |
| 无新词 | 20 | 0 |

其他规则：
- 到期需复习的单词按评分（逾期、错误率、学习阶段、近期练习）优先入队
- 错题在复习位中优先出现，但最多约占复习位的 **40%**，避免连续刷挫败词
- 新词按顺序游标推进，保证稳定接触新内容
- 最近练过的词在硬排除窗口内不会重复出现；候选不足时逐步放宽窗口
- 已掌握词默认不进主队列，仅在词池不足时低频填充

### 智能提示系统

| 触发条件 | 行为 |
|----------|------|
| 🆕 新单词首次遇到 | 自动显示答案 3 秒学习，然后开始练习 |
| ⏸️ 输入停止 **8 秒** | 开始逐字母提示 |
| 🔤 之后每 **5 秒** | 显示一个新字母 |
| 🆘 卡住 **30 秒** | 显示完整学习卡片（中英对照） |
| 📌 使用了提示的单词 | 标记为"学习中"，不会进入"已掌握"状态 |

### 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Enter` | 显示答案 / 下一个单词 |
| `Esc` | 返回首页 |

---

## 🧠 艾宾浩斯记忆引擎

复习间隔遵循 **艾宾浩斯遗忘曲线** 的 8 级递进：

| 阶段 | 复习间隔 |
|:----:|:--------:|
| 0 → 1 | 5 分钟 |
| 1 → 2 | 30 分钟 |
| 2 → 3 | 12 小时 |
| 3 → 4 | 1 天 |
| 4 → 5 | 2 天 |
| 5 → 6 | 4 天 |
| 6 → 7 | 7 天 |
| 7 → 8 | 15 天 |

**核心机制**：
- **答对** → 阶段升级，进入下一复习间隔
- **答错** → 阶段归零，从头开始
- **使用提示答对** → 最多升至阶段 1（"学习中"状态）
- 阶段 8 以上标记为 **"已掌握"**，不再自动出现

---

## 📂 项目结构

```
qianshu-word-leaner/
├── index.html              # 主入口 HTML
├── css/
│   └── style.css           # 全部样式（含明/暗主题）
├── js/
│   ├── memory.js           # 艾宾浩斯记忆曲线引擎
│   ├── feed-builder.js     # 练习队列排词策略
│   ├── data-loader.js      # 词库加载与解析
│   ├── typing-game.js      # 打字游戏主逻辑
│   ├── pronunciation.js    # 单词发音（有道 API）
│   └── sound-effects.js    # 按键音效管理
├── data/
│   ├── 9.xml               # 小学英语单词 1（200 词）
│   ├── 10.xml              # 小学英语单词 2（200 词）
│   ├── 11.xml              # 小学英语单词 3（48 词）
│   ├── computer.csv        # 计算机兴趣词包
│   └── trans_dict.xml      # 英汉翻译字典
├── sounds/
│   ├── key.wav             # 按键音效
│   ├── correct.wav         # 答对音效
│   └── beep.wav            # 提示音效
├── docs/
│   └── superpowers/        # 产品规划与规格
├── test/
│   ├── feed-builder.test.js   # Feed V2 回归测试
│   ├── data-loader.test.js    # 词库路径回归测试
│   ├── memory.test.js         # 艾宾浩斯记忆引擎回归测试
│   ├── pronunciation.test.js  # 发音 URL 与配置回归测试
│   └── typing-game.test.js    # 会话统计与学习卡 HTML 回归测试
├── capacitor.config.json   # Capacitor 移动端配置
├── package.json            # npm 依赖与脚本
├── ANDROID_BUILD.md        # Android 打包指南
└── README.md               # 项目文档（本文件）
```

---

## 🏗️ 技术架构

| 层 | 技术 |
|:---|:-----|
| 前端框架 | 原生 HTML5 + CSS3 + JavaScript (ES6+) |
| 图标 | Lucide Icons |
| 音效 | Howler.js |
| 发音 | 有道词典语音 API |
| 数据持久化 | 浏览器 localStorage |
| 移动端 | Capacitor 8 (Android) |
| 词库格式 | XML / CSV |

### 核心模块

- **记忆引擎** (`memory.js`) — `MemoryManager` 类，封装所有复习算法
- **排词器** (`feed-builder.js`) — 根据记忆状态生成最优练习队列
- **主控逻辑** (`typing-game.js`) — 游戏流程控制与 UI 交互
- **数据加载** (`data-loader.js`) — 词库 XML/CSV 解析
- **发音模块** (`pronunciation.js`) — 有道 TTS API 调用
- **音效管理** (`sound-effects.js`) — 键盘/正确/提示音

---

## 🛠️ 开发指南

### 环境要求

- 现代浏览器（Chrome / Firefox / Safari / Edge）
- 本地 HTTP 服务器
- （可选）Node.js 16+ + Android Studio — 用于打包 Android APP

### 自定义词包

1. 在 `data/` 目录下创建 XML 或 CSV 格式的词库文件
2. 在 `data-loader.js` 中注册新的加载逻辑
3. 在 `index.html` 中添加词包切换选项

XML 格式参考：
```xml
<word>
    <word>apple</word>
    <meaning>苹果</meaning>
    <pronunciation>/ˈæp.l̩/</pronunciation>
</word>
```

### 清除学习进度

```javascript
localStorage.clear()
```

---

## 📱 Android 打包

详见 [ANDROID_BUILD.md](./ANDROID_BUILD.md)。

```bash
npm run cap:sync              # 同步 Web 文件到 Android
npm run cap:open:android      # 打开 Android Studio
npm run cap:run:android       # 直接运行到设备
```

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可

MIT License © 2024 ironfrancis

---

> 🌱 **千树** — 每一天在键盘上种下一棵树，终将长成一片森林。
