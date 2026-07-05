# 🤝 贡献指南

感谢你对千树背单词项目的关注！这个项目始于父子编程学习之旅，欢迎任何形式的贡献。

---

## 🐛 报告 Bug

如果发现 Bug，请通过 [GitHub Issues](https://github.com/ironfrancis/qianshu-word-leaner/issues) 提交，说明：

- 问题的清晰描述
- 复现步骤
- 期望行为和实际行为
- 浏览器环境和版本
- 截图（如适用）

---

## 💡 功能建议

欢迎提交功能建议！请在 Issue 中描述：

- 你想解决的问题
- 你期望的方案
- 大致的实现思路（可选）

---

## 🔧 本地开发

### 环境要求

- Git
- 现代浏览器（Chrome / Firefox / Safari / Edge）
- 任意 HTTP 服务器（推荐 VS Code Live Server）

### 开发流程

```bash
# 1. Fork 本项目
# 2. 克隆你的 fork
git clone https://github.com/你的用户名/qianshu-word-leaner.git
cd qianshu-word-leaner

# 3. 创建特性分支
git checkout -b feature/你的功能

# 4. 启动本地开发服务器（VS Code Live Server 或 Python）
python -m http.server 8000

# 5. 浏览器访问 http://localhost:8000

# 6. 修改代码后提交
git add .
git commit -m "feat: 添加你的功能描述"

# 7. 推送到你的 fork
git push origin feature/你的功能

# 8. 提交 Pull Request
```

### 开发规范

| 规范 | 说明 |
|:-----|:-----|
| **代码风格** | 保持现有风格，JavaScript ES6+ |
| **命名** | `camelCase` 命名函数和变量，`PascalCase` 命名类 |
| **注释** | 关键逻辑需添加中文注释 |
| **提交信息** | 使用 `feat:` / `fix:` / `docs:` / `refactor:` 前缀 |

---

## 🧪 测试

### 自动化回归测试

项目已包含 Node 下的轻量回归测试（无需浏览器）：

```bash
npm test
```

当前覆盖：

- `test/feed-builder.test.js` — Feed V2 动态配比、错题上限、近期排除、新词游标
- `test/data-loader.test.js` — 词库 `fetch` 路径、`parseCSVLine` 引号内逗号、`getMeaning` 大小写匹配
- `test/memory.test.js` — 艾宾浩斯 stage 升降、到期判定、状态分类、旧数据迁移
- `test/pronunciation.test.js` — 有道发音 URL 生成、美/英音切换、音量 clamp
- `test/typing-game.test.js` — 会话空统计结构、挑战模式批次数、学习卡 HTML 生成
- `test/sound-effects.test.js` — 音效开关 toggle、音量 clamp、禁用时跳过播放

修改 `js/feed-builder.js`、`js/data-loader.js`、`js/memory.js`、`js/pronunciation.js`、`js/typing-game.js` 或 `js/sound-effects.js` 后，请先运行 `npm test`。

### 手动测试

提交 PR 前还请在浏览器中验证核心功能：

- 词包切换
- 练习模式（小试牛刀 + 挑战模式）
- 答题正确/错误反馈
- 智能提示系统
- 主题切换
- 发音和音效
- 检查浏览器控制台无错误日志

---

## 📝 Pull Request 流程

1. 确保你的 fork 与上游保持同步
2. 在 PR 描述中说明改动内容
3. 关联相关 Issue（如有）
4. 等待 Review

---

## 🏷️ 标签说明

| 标签 | 说明 |
|:-----|:------|
| `bug` | 错误修复 |
| `enhancement` | 功能增强 |
| `documentation` | 文档改进 |
| `good first issue` | 适合新手入门 |

---

## 📜 行为准则

- 保持友善和尊重
- 建设性地提出意见
- 关注代码本身，而非个人

---

再次感谢你的贡献！🌱
