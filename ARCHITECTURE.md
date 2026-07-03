# 🏗️ 千树背单词 — 架构说明

> 本文档描述千树背单词项目的整体架构、模块职责和数据流。

---

## 1. 整体架构概览

千树背单词是一个 **纯前端单页应用**，采用模块化 JavaScript 架构，无后端依赖。

```
┌─────────────────────────────────────────────────┐
│                   index.html                     │
│          (SPA 入口 · UI 布局 · 视图切换)          │
├─────────────────────────────────────────────────┤
│  css/style.css                                   │
│  (响应式布局 · 明/暗主题 · 动画)                  │
├──────────┬──────────┬──────────┬─────────────────┤
│ memory.js│feed-     │data-     │ typing-game.js  │
│ (记忆引擎)│builder.js│loader.js │ (主控逻辑)       │
│          │(排词策略) │(词库解析) │                  │
├──────────┴──────────┴──────────┴─────────────────┤
│ pronunciation.js  │  sound-effects.js             │
│ (发音模块)         │  (音效管理)                    │
├───────────────────┴──────────────────────────────┤
│ 数据层                                            │
│ localStorage (学习进度) · XML/CSV (词库)          │
└──────────────────────────────────────────────────┘
```

---

## 2. 核心模块详解

### 2.1 记忆引擎 — `memory.js` 🧠

**职责**：管理每个单词的复习状态，实现艾宾浩斯遗忘曲线算法。

**核心类**：`MemoryManager`

```
MemoryManager
├── data: { word → WordRecord }   # 内存中的学习数据
├── loadData() / saveData()       # localStorage 读写
│
├── 状态查询
│   ├── getWord(word)             # 获取单词学习记录
│   ├── getWordStatus(word)       # new / learning / mastered / mistake
│   ├── needsReview(word)         # 是否到期需复习
│   └── getNextReviewTime(word)   # 下次复习时间戳
│
├── 答题记录
│   ├── recordResult(word, correct)         # 记录答题结果
│   └── recordResultWithHint(word, correct) # 带提示的答题结果
│
├── 数据筛选
│   ├── getNewWords(list)         # 新词（从未练习）
│   ├── getDueReviewWords(list)   # 到期需复习的词
│   ├── getMistakeWords(list)     # 错题（按错误率排序）
│   └── filterWordsByMode(list)   # 按模式筛选
│
├── 统计
│   └── getStats(wordList)        # 总览统计
│
└── 数据管理
    ├── resetAll() / resetWord()
    ├── exportData() / importData()
    └── saveData()                # 每次修改后自动持久化
```

**数据模型**（存储结构）：
```json
{
  "apple": {
    "word": "apple",
    "meaning": "苹果",
    "stage": 3,           // 当前阶段 0-8+
    "lastReview": 1700000000000,
    "correctCount": 5,
    "errorCount": 1,
    "totalAttempts": 6
  }
}
```

**复习阶段算法**：
- 答对 → `stage++`，推进到下一个复习间隔
- 答错 → `stage = 0`，从头开始
- 使用提示答对 → `stage = Math.min(stage, 1)`（限制在"学习中"）
- 无提示答对且 `stage >= 8` → 标记为"已掌握"

### 2.2 排词策略 — `feed-builder.js` 📋

**职责**：根据记忆状态为每次练习生成最优队列。

**核心函数**：`buildSessionQueue(wordList, options)`

```
buildSessionQueue
├── 获取到期复习词   → 按到期时间排序，优先队列
├── 获取错题集       → 按错误率降序，混入复习位
├── 获取新词         → 从未练习池中抽取
└── 组装返回         → 最终队列（含单词来源标记）
```

**排词配置**：
```
SESSION_SIZE = 20        # 每批/每轮单词数
目标比例：12 复习 + 8 新词
优先级：错题 > 到期复习 > 新词
```

### 2.3 词库加载 — `data-loader.js` 📖

**职责**：加载和解析不同格式的词库文件。

**核心函数**：`loadDefaultWordPack()` / `switchWordPack(name)`

| 函数 | 功能 |
|:-----|:-----|
| `loadDefaultWordPack()` | 加载小学英语全部词包（9.xml + 10.xml + 11.xml + trans_dict.xml） |
| `switchWordPack(name)` | 切换到指定词包（primary / computer） |
| `getCurrentWordList()` | 获取当前词包的单词列表 |
| `getWordObject(word)` | 获取单个单词的中文释义 |

**数据管道**：
```
XML/CSV 文件 → fetch() → 解析器 → Word对象数组 → 全局变量
```

### 2.4 主控逻辑 — `typing-game.js` 🎮

**职责**：控制整个打字练习的游戏流程和 UI 交互。

**核心状态**：
```
sessionType        # quick / challenge
practiceQueue      # 当前练习队列
sessionStats       # 本轮统计（正确/错误/连续正确）
hintTimers         # 智能提示定时器
```

**游戏流程**：
```
首页选择词包
    ↓
选择练习模式（小试牛刀 / 挑战模式）
    ↓
加载队列 → 显示中文释义
    ↓
用户键盘输入英文
    ↓
├── 正确 → 发音 + 音效 → 进度推进 → 下一个词
└── 错误 → 输入框清空 → 错误计数 +1
    ↓
智能提示（8秒/5秒/30秒三级渐进）
    ↓
一轮完成 → 显示统计 → 返回首页或再来一轮
```

**UI 状态管理**：
```
showSection(id) 切换显示区块：
├── word-source-section    # 首页词包选择
├── practice-section       # 练习界面
├── complete-section       # 完成统计
└── word-list-section      # 单词列表
```

### 2.5 发音模块 — `pronunciation.js` 🔉

**职责**：调用有道词典 TTS API 播放单词发音。

**核心类**：`PronunciationManager`，支持音效开关切换。

### 2.6 音效管理 — `sound-effects.js` 🔊

**职责**：管理机械键盘打字音效。

**核心类**：`SoundManager`

| 音效文件 | 触发场景 |
|:---------|:---------|
| `key.wav` | 每次按键输入 |
| `correct.wav` | 答对时 |
| `beep.wav` | 提示出现时 |

---

## 3. 数据流

### 3.1 学习流程数据流

```
用户输入单词
    ↓
typing-game.js 检测输入
    ├── 逐字母匹配 → 实时反馈
    └── 完整匹配 → 调用 recordResult()
                        ↓
                  memory.js 更新单词阶段
                        ↓
                  更新 sessionStats
                        ↓
                  加载下一个单词
```

### 3.2 持久化数据流

```
memory.js
├── 初始化 → localStorage.getItem() → 恢复学习记录
├── 每次答题 → 更新内存 → saveData() → localStorage.setItem()
└── 页面刷新 → 重新加载已保存数据
```

### 3.3 词包切换数据流

```
用户点击词包标签
    ↓
switchWordPack(name)
    ↓
data-loader.js 加载对应 XML/CSV
    ↓
更新全局词包变量
    ↓
更新首页统计信息
    ↓
ready 开始练习
```

---

## 4. 主题系统

- 支持 **浅色** / **深色** 两种主题
- 通过 CSS 变量实现（`body.dark-mode`）
- 主题偏好存储在 `localStorage.theme`

---

## 5. 移动端适配

- **响应式布局**：CSS 媒体查询适配手机屏幕
- **Capacitor 打包**：将 Web 应用包装为原生 Android APP
- Android 应用访问本地文件时无需 HTTP 服务器

---

## 6. 扩展点

| 扩展方向 | 需要修改的文件 |
|:---------|:--------------|
| 添加新词包 | `data/*` + `data-loader.js` + `index.html` |
| 调整复习间隔 | `memory.js` 中 `REVIEW_INTERVALS` 数组 |
| 修改排词比例 | `feed-builder.js` 中 `REVIEW_RATIO` |
| 新增发音源 | `pronunciation.js` |
| 添加更多音效 | `sounds/*` + `sound-effects.js` |
| 增加新功能 | `typing-game.js` 主控逻辑 |
