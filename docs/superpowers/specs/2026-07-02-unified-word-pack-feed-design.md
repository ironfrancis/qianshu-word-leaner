# 统一词包与 Feed 学习 Session 设计

**日期:** 2026-07-02  
**状态:** 待审阅  
**范围:** 将分包选词改为单一小学词包 + 双档位 Session Feed

---

## 1. 背景与目标

### 问题

当前应用按 `9.xml` / `10.xml` / `11.xml` / 全部 448 词 四个入口选词，选完后在「学习 / 复习 / 错题本」三种 Tab 下线性刷完整队列。一次 200 词对碎片时间用户负担过重，模式选择也增加了认知成本。

### 目标

1. **单一词包**：默认「小学英语全部 · 448 词」，去掉分包按钮。
2. **双档位 Session**：
   - **小试牛刀**：固定 20 词，练完即结束并展示小结。
   - **挑战模式**：每批 20 词，批与批之间自动续接，用户手动结束。
3. **统一 Feed**：去掉模式 Tab，系统自动混合到期复习、新词、错题加权。
4. **兼容现有记忆系统**：继续按单词粒度使用 localStorage + 艾宾浩斯阶段，不引入 session 级持久化。

### 非目标（YAGNI）

- 固定时长 Session（如 5 分钟）
- 用户自定义每批词数
- 保留子词包入口或折叠菜单
- 后端同步 / 多设备进度
- 新增第三、第四档位

---

## 2. 用户流程

```
首页
 └─ 词包卡片：「小学英语全部 · 448 词」
      │  （展示：待复习 N · 新词 M · 错题 K）
      ├─ [小试牛刀]  20 词 · 约 5 分钟
      └─ [挑战模式]  每批 20 词 · 随时结束
           ↓
      练习界面（无 Tab）
           ├─ 小试牛刀：进度 8/20
           ├─ 挑战模式：第 2 批 · 8/20 · 累计 28 词
           ├─ [结束练习]（挑战模式常驻）
           └─ 完成 → 小结页
```

### 首页

- 移除 4 个分包按钮，改为 1 个词包卡片 + 2 个档位按钮。
- 词包卡片展示轻量统计（基于 `memoryManager.getStats`）：
  - **待复习**：`needsReview` 且 `totalAttempts > 0`
  - **新词**：`totalAttempts === 0`
  - **错题**：`errorCount > correctCount`

### 小试牛刀

- 进入时预生成 **目标 20 词** 的队列；词池充足时恰好 20 词，词池不足时返回实际可练数量。
- 进度显示 `当前/20`。
- 本批队列完成后进入 **Session 小结页**（正确率、新词/复习/错题计数）。
- 小结页提供「再来一轮」和「返回首页」。

### 挑战模式

- 进入时预生成 **第 1 批 20 词**。
- 进度显示 `第 N 批 · 当前/20`，并显示 **累计已练词数**。
- 当前批第 20 词完成后 **自动续下一批**（重新调用 Feed 算法，排除本 session 已练词）。
- 顶部/底部常驻 **「结束练习」** 按钮；任意时刻可退出并进入小结页。
- 小结页展示累计统计（总词数、批次数、正确率等）。

---

## 3. Feed 排词算法（方案 A：预生成队列）

### 常量

```javascript
const SESSION_SIZE = 20;
const REVIEW_TARGET = 12;  // 复习位目标
const NEW_TARGET = 8;        // 新词位目标
const MISTAKE_REVIEW_CAP = 3; // 未到期错题最多占复习位数量
```

### 词池定义

给定完整词列表 `wordList`（448 词）及 session 内已练集合 `sessionSeen`：

| 池 | 条件 |
|----|------|
| **到期复习池** | `needsReview(word) && totalAttempts > 0 && !sessionSeen` |
| **错题池** | `errorCount > correctCount && !sessionSeen` |
| **新词池** | `totalAttempts === 0 && !sessionSeen` |

### 复习位（目标 12 个）

按优先级依次填充，直到满 12 或池耗尽：

1. **到期复习 + 错题**（到期且 errorCount > correctCount），按错误率降序。
2. **到期复习 + 普通学习中**（到期且非错题），按 `getNextReviewTime` 升序（最过期优先）。
3. **未到期错题**（占复习位，最多 `MISTAKE_REVIEW_CAP = 3` 个），按错误率降序。
4. 复习位未满 → 剩余名额留给新词位补位（见下）。

### 新词位（目标 8 个）

1. 从 **新词池** 按 XML 原始顺序取词（保持教材顺序感）。
2. 新词不足 8 → 用 **复习候选池中尚未选入队列的词** 补位，顺序仍按「到期错题 → 到期普通复习 → 未到期错题」。
3. 新词位补位后复习位仍不足 12 → 接受实际比例（见边界情况）。

### 合并与打散

- 将 12 复习 + 8 新词合并为 20 词。
- **打散规则**：避免连续 3 个以上同类型（复习/新词/错题）；简单实现为按 `[R,N,R,N,...]` 交错后截断至 20，不足处顺序追加。
- **去重**：同一 session 内同一单词只出现一次。

### 挑战模式续批

- 当前批完成后，`sessionSeen` 加入本批 20 词。
- 调用同一 `buildSessionQueue(wordList, { limit: 20, seen: sessionSeen })`。
- 若返回 0 词 → 展示「暂无更多待练单词」并引导结束或返回首页。

### 小试牛刀 vs 挑战模式

两者使用 **同一 Feed 算法、同一批大小（20）**。差异仅在：

| | 小试牛刀 | 挑战模式 |
|--|---------|---------|
| 批次数 | 1 | 不限 |
| 续批 | 否 | 是 |
| 结束方式 | 自动（20 词后） | 手动或词池耗尽 |
| 进度文案 | `8/20` | `第 2 批 · 8/20 · 累计 28 词` |

---

## 4. 架构与模块

### 新增：`js/feed-builder.js`

```javascript
/**
 * @param {string[]} wordList - 完整词包
 * @param {object} options
 * @param {number} options.limit - 本批词数，固定 20
 * @param {Set<string>} options.seen - session 内已练词
 * @returns {string[]} 排好序的词列表，长度 <= limit
 */
function buildSessionQueue(wordList, { limit = 20, seen = new Set() } = {}) {}
```

内部函数：

- `pickReviewWords(wordList, count, seen)` — 复习位选词
- `pickNewWords(wordList, count, seen)` — 新词位选词
- `interleaveAndShuffle(reviewWords, newWords)` — 合并打散

### 修改：`js/memory.js`

新增查询 helper（不改变现有 `recordResult` 逻辑）：

- `getDueReviewWords(wordList, seen)` — 到期复习列表
- `getMistakeWords(wordList, seen)` — 错题列表
- `getNewWords(wordList, seen)` — 新词列表
- `getPackStats(wordList)` — 首页统计（封装现有 `getStats`）

### 修改：`js/data-loader.js`

- 启动流程默认加载 `all`（448 词）。
- 移除 `loadWordSource('9.xml')` 等分包入口调用；保留 `parseWordXML` 供 `all` 合并使用。
- 新增 `loadDefaultWordPack()` 供首页直接调用。

### 修改：`js/typing-game.js`

- 移除 `switchMode`、`currentMode`、模式 Tab 相关逻辑。
- 新增 `sessionType: 'quick' | 'challenge'`。
- 新增 `sessionSeen: Set<string>`、`batchIndex: number`、`totalWordsInSession: number`。
- `initPractice(sessionType)` → 调用 `buildSessionQueue` 生成队列。
- 小试牛刀：`practiceIndex >= 20` → `showSessionComplete()`。
- 挑战模式：`practiceIndex >= 20` → 续批或词池耗尽提示；`endChallenge()` → 小结。
- 移除 `updateBadges` 中对 review-count / mistake-count 的 Tab 徽章更新。

### 修改：`index.html`

- 词源选择区改为：词包卡片 + 小试牛刀 / 挑战模式按钮。
- 移除 `.mode-switch`（三个 Tab）。
- 练习区新增挑战模式「结束练习」按钮（默认 hidden，挑战模式显示）。
- 新增 Session 小结区块 `#session-complete-section`（或复用 `#complete-section` 并扩展字段）。
- 新增 `<script src="js/feed-builder.js"></script>`，加载顺序放在 `memory.js` 之后、`typing-game.js` 之前。

### 修改：`css/style.css`

- 词包卡片、档位按钮、挑战进度、结束按钮样式。
- 移除或保留 `.mode-switch` 样式（若无引用则删）。

---

## 5. 数据流

```
loadDefaultWordPack()
  → currentWordList (448)
  → memoryManager.getPackStats() → 首页展示

用户点击 [小试牛刀]
  → initPractice('quick')
  → buildSessionQueue(wordList, { limit: 20 })
  → practiceQueue[20]
  → loadNextWord() × 20
  → showSessionComplete()

用户点击 [挑战模式]
  → initPractice('challenge')
  → buildSessionQueue(...) → 第 1 批
  → 批满 → buildSessionQueue(..., { seen }) → 第 2 批
  → endChallenge() → showSessionComplete()

每词答题
  → memoryManager.recordResult / recordResultWithHint（不变）
  → sessionSeen.add(word)（必须，在单词进入当前 session 队列时维护，确保挑战模式续批不重复）
```

**持久化**：仅单词级 progress（现有 `english_typing_progress`）。Session 统计（本批正确率等）仅内存，小结页展示后丢弃。

---

## 6. 边界情况

| 场景 | 行为 |
|------|------|
| 全新用户，448 词均未练 | 20 词全部来自新词池 |
| 到期复习 < 12 | 复习位按实际数量填充，新词位扩展至凑满 20 |
| 新词 < 8 | 新词全取，复习位扩展至凑满 20 |
| 到期复习 + 新词合计 < 20 | 返回实际数量；小结显示「本批 N 词」 |
| 448 词全部掌握（stage 满且无到期） | 首页提示「暂无待练单词」；V1 不从已掌握池随机抽词 |
| 挑战模式词池耗尽 | 弹窗/小结：「太棒了，暂无更多待练单词！」 |
| 挑战模式第 1 词前点结束 | 小结显示「已练 0 词」，返回首页 |
| session 内去重 | 续批时 `seen` 包含所有已练词，不重复 |

**V1 词池耗尽处理**：若 `buildSessionQueue` 返回空数组，直接结束 session 并展示小结，不实现 mastered 随机巩固。

---

## 7. UI 文案

| 元素 | 文案 |
|------|------|
| 词包标题 | 小学英语全部 |
| 词包副标题 | 448 个单词 |
| 小试牛刀按钮 | 小试牛刀 · 20 词 |
| 挑战模式按钮 | 挑战模式 · 每批 20 词 |
| 小试牛刀进度 | `8/20` |
| 挑战进度 | `第 2 批 · 8/20 · 累计 28 词` |
| 结束按钮 | 结束练习 |
| 小结标题（小试牛刀） | 本轮完成！ |
| 小结标题（挑战） | 挑战结束！ |

---

## 8. 测试计划

### 手动测试

1. 首页仅显示一个词包 + 两个档位，无分包按钮、无 Tab。
2. 新用户小试牛刀：20 词均为新词，进度 1/20 → 20/20，进入小结。
3. 有复习记录用户：小试牛刀大致符合 12 复习 + 8 新词（允许边界偏差）。
4. 错题词在复习位中优先于普通到期复习。
5. 挑战模式：练满 20 词自动续第 2 批，累计计数正确，session 内无重复词。
6. 挑战模式中途「结束练习」：进度保存，小结数据正确。
7. 词池不足 20：实际词数正确，不报错。
8. 词池耗尽：挑战模式正常结束并展示小结。
9. 现有功能回归：打字判定、提示系统、显示答案、发音、主题切换正常。

### 可选单元测试（V1 不强制）

- `buildSessionQueue` 返回长度 ≤ 20
- session 内无重复
- 新词池为空时复习位补满

---

## 9. 实现顺序建议

1. `feed-builder.js` + memory helper
2. `data-loader.js` 默认词包加载
3. `index.html` 首页与练习区 UI
4. `typing-game.js` session 逻辑改造
5. `css/style.css` 样式
6. 手动测试与 README 更新

---

## 10. 决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| Feed 实现 | 方案 A：预生成队列 | 与现有 queue 模型一致，改动最小 |
| Session 大小 | 20 词/批 | 小试牛刀与挑战模式统一批大小 |
| 复习:新词比例 | 12:8 目标 | 平衡记忆巩固与新词推进 |
| 模式 Tab | 移除，统一 Feed | 降低碎片学习操作成本 |
| 词包入口 | 仅 448 词大词包 | 简化选词，符合「一个小学词包」愿景 |
| 错题处理 | 复习位加权，最多 3 个未到期错题 | 强化薄弱词，避免整批都是错题 |
| 挑战续批 | 每 20 词自动续批 | 用户确认；与预生成队列模型一致 |
