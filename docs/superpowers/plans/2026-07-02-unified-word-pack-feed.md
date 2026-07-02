# Unified Word Pack Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace source-file and mode-based practice with a single 448-word pack plus two feed-driven session buttons: 20-word quick practice and 20-word challenge batches.

**Architecture:** Keep the existing pure HTML/CSS/JavaScript app and localStorage memory model. Add a focused `js/feed-builder.js` module for feed selection, add read-only query helpers to `MemoryManager`, then simplify `typing-game.js` from mode queues to session queues.

**Tech Stack:** Plain HTML, CSS, JavaScript, browser localStorage, XML files loaded through `fetch`, Python static server for manual testing.

---

## File Structure

- Create: `js/feed-builder.js`
  - Responsible for selecting 20-word session queues from the full word list.
  - Depends on global `memoryManager` from `js/memory.js`.

- Modify: `js/memory.js`
  - Add query helper methods for new words, due review words, mistake words, and pack stats.
  - Do not change answer recording behavior.

- Modify: `js/data-loader.js`
  - Add `loadDefaultWordPack()` and `updatePackOverview()`.
  - Keep XML parsing helpers.
  - Keep `getCurrentWordList()` and `getWordObject()`.

- Modify: `js/typing-game.js`
  - Replace `currentMode` and mode switching with `sessionType`, `sessionSeen`, `batchIndex`, and session queue logic.
  - Keep input checking, hints, answer display, sound, pronunciation, and theme logic.

- Modify: `index.html`
  - Replace source buttons with one pack card and two session buttons.
  - Remove mode tabs.
  - Add challenge end button and session completion fields.
  - Load `js/feed-builder.js` between `memory.js` and `data-loader.js` or before `typing-game.js`.

- Modify: `css/style.css`
  - Add pack card, session choice, challenge action, and updated completion styles.
  - Remove mode switch styles only after the HTML no longer uses them.

- Modify: `README.md`
  - Update usage and mode descriptions to match the new quick/challenge flow.

---

## Task 1: Add Memory Query Helpers

**Files:**
- Modify: `js/memory.js`

- [ ] **Step 1: Add helper methods inside `MemoryManager` after `getStats(wordList)`**

Add these methods before `filterWordsByMode(wordList, mode)`:

```javascript
    /**
     * 获取新的、从未练习过的单词
     */
    getNewWords(wordList, seen = new Set()) {
        return wordList.filter(word => {
            const record = this.getWord(word);
            return !seen.has(word) && record.totalAttempts === 0;
        });
    }

    /**
     * 获取到期需要复习的单词
     */
    getDueReviewWords(wordList, seen = new Set()) {
        return wordList
            .filter(word => {
                const record = this.getWord(word);
                return !seen.has(word) && record.totalAttempts > 0 && this.needsReview(word);
            })
            .sort((a, b) => this.getNextReviewTime(a) - this.getNextReviewTime(b));
    }

    /**
     * 获取错题，按错误率从高到低排序
     */
    getMistakeWords(wordList, seen = new Set()) {
        return wordList
            .filter(word => {
                const record = this.getWord(word);
                return !seen.has(word) && record.totalAttempts > 0 && record.errorCount > record.correctCount;
            })
            .sort((a, b) => {
                const recordA = this.getWord(a);
                const recordB = this.getWord(b);
                const errorRateA = recordA.errorCount / (recordA.totalAttempts || 1);
                const errorRateB = recordB.errorCount / (recordB.totalAttempts || 1);
                return errorRateB - errorRateA;
            });
    }

    /**
     * 获取首页词包统计
     */
    getPackStats(wordList) {
        const stats = this.getStats(wordList);
        stats.dueReview = wordList.filter(word => {
            const record = this.getWord(word);
            return record.totalAttempts > 0 && this.needsReview(word);
        }).length;
        return stats;
    }
```

- [ ] **Step 2: Verify the file still parses**

Run:

```bash
node --check js/memory.js
```

Expected: no output and exit code 0.

- [ ] **Step 3: Commit this task**

```bash
git add js/memory.js
git commit -m "Add memory query helpers for feed sessions."
```

---

## Task 2: Create Feed Builder

**Files:**
- Create: `js/feed-builder.js`

- [ ] **Step 1: Create `js/feed-builder.js`**

Use this complete file:

```javascript
/**
 * Feed 构建模块
 * 按 12 复习 + 8 新词的目标比例生成一批练习单词。
 */

const SESSION_SIZE = 20;
const REVIEW_TARGET = 12;
const NEW_TARGET = 8;
const MISTAKE_REVIEW_CAP = 3;

function getErrorRate(word) {
    const record = memoryManager.getWord(word);
    return record.errorCount / (record.totalAttempts || 1);
}

function uniqueWords(words) {
    return [...new Set(words)];
}

function takeAvailable(words, count, selected) {
    const result = [];

    for (const word of words) {
        if (result.length >= count) break;
        if (selected.has(word)) continue;

        selected.add(word);
        result.push(word);
    }

    return result;
}

function pickReviewWords(wordList, count, seen = new Set()) {
    const selected = new Set();
    const dueWords = memoryManager.getDueReviewWords(wordList, seen);
    const mistakeWords = memoryManager.getMistakeWords(wordList, seen);

    const dueMistakes = dueWords
        .filter(word => mistakeWords.includes(word))
        .sort((a, b) => getErrorRate(b) - getErrorRate(a));

    const dueRegular = dueWords.filter(word => !mistakeWords.includes(word));
    const overdueMistakes = takeAvailable(dueMistakes, count, selected);
    const regularReviews = takeAvailable(dueRegular, count - overdueMistakes.length, selected);

    const reviewWords = [...overdueMistakes, ...regularReviews];
    const remainingCount = count - reviewWords.length;

    if (remainingCount <= 0) {
        return reviewWords;
    }

    const notDueMistakes = mistakeWords
        .filter(word => !selected.has(word) && !dueWords.includes(word))
        .slice(0, Math.min(MISTAKE_REVIEW_CAP, remainingCount));

    return [...reviewWords, ...notDueMistakes];
}

function pickNewWords(wordList, count, seen = new Set(), selected = new Set()) {
    const newWords = memoryManager
        .getNewWords(wordList, seen)
        .filter(word => !selected.has(word));

    return newWords.slice(0, count);
}

function interleaveReviewAndNew(reviewWords, newWords, limit) {
    const result = [];
    const reviewQueue = [...reviewWords];
    const newQueue = [...newWords];

    while (result.length < limit && (reviewQueue.length > 0 || newQueue.length > 0)) {
        if (reviewQueue.length > 0) {
            result.push(reviewQueue.shift());
        }

        if (result.length >= limit) break;

        if (newQueue.length > 0) {
            result.push(newQueue.shift());
        }
    }

    return result.slice(0, limit);
}

function buildSessionQueue(wordList, { limit = SESSION_SIZE, seen = new Set() } = {}) {
    const selected = new Set(seen);
    const reviewWords = pickReviewWords(wordList, REVIEW_TARGET, seen);

    reviewWords.forEach(word => selected.add(word));

    const newWords = pickNewWords(wordList, NEW_TARGET, seen, selected);
    newWords.forEach(word => selected.add(word));

    const queue = interleaveReviewAndNew(reviewWords, newWords, limit);

    if (queue.length >= limit) {
        return uniqueWords(queue).slice(0, limit);
    }

    const remainingCandidates = [
        ...memoryManager.getDueReviewWords(wordList, seen),
        ...memoryManager.getMistakeWords(wordList, seen),
        ...memoryManager.getNewWords(wordList, seen)
    ].filter(word => !selected.has(word));

    const fillers = takeAvailable(remainingCandidates, limit - queue.length, selected);
    return uniqueWords([...queue, ...fillers]).slice(0, limit);
}
```

- [ ] **Step 2: Verify syntax**

Run:

```bash
node --check js/feed-builder.js
```

Expected: no output and exit code 0.

- [ ] **Step 3: Commit this task**

```bash
git add js/feed-builder.js
git commit -m "Add feed builder for 20-word sessions."
```

---

## Task 3: Load the Unified Word Pack

**Files:**
- Modify: `js/data-loader.js`

- [ ] **Step 1: Add `loadAllWords()` helper above `loadWordSource(source)`**

```javascript
async function loadAllWords() {
    const words9 = await parseWordXML('9.xml');
    const words10 = await parseWordXML('10.xml');
    const words11 = await parseWordXML('11.xml');
    return [...new Set([...words9, ...words10, ...words11])];
}
```

- [ ] **Step 2: Replace the body of `loadWordSource(source)` with a compatibility wrapper**

```javascript
async function loadWordSource(source) {
    showSection('loading-section');

    try {
        await loadTranslationDict();

        const wordList = source === 'all'
            ? await loadAllWords()
            : [...new Set(await parseWordXML(source))];

        currentWordList = wordList.map(word => ({
            word: word,
            meaning: getMeaning(word)
        }));

        console.log(`加载完成: ${currentWordList.length} 个单词`);
        updatePackOverview();
        showSection('word-source-section');
    } catch (error) {
        console.error('加载失败:', error);
        alert(`加载失败: ${error.message}\n请确保data文件夹中有相应的XML文件。`);
        showSection('word-source-section');
    }
}
```

- [ ] **Step 3: Add default loading and pack stats helpers below `loadWordSource(source)`**

```javascript
async function loadDefaultWordPack() {
    await loadWordSource('all');
}

function updatePackOverview() {
    const wordList = currentWordList.map(item => item.word);
    const stats = memoryManager.getPackStats(wordList);

    const totalEl = document.getElementById('pack-total-count');
    const reviewEl = document.getElementById('pack-review-count');
    const newEl = document.getElementById('pack-new-count');
    const mistakeEl = document.getElementById('pack-mistake-count');

    if (totalEl) totalEl.textContent = stats.total;
    if (reviewEl) reviewEl.textContent = stats.dueReview;
    if (newEl) newEl.textContent = stats.new;
    if (mistakeEl) mistakeEl.textContent = stats.mistake;
}
```

- [ ] **Step 4: Keep `getAvailableWords(mode)` until `typing-game.js` no longer uses it**

No code change in this step. It avoids breaking the app between tasks.

- [ ] **Step 5: Verify syntax**

Run:

```bash
node --check js/data-loader.js
```

Expected: no output and exit code 0.

- [ ] **Step 6: Commit this task**

```bash
git add js/data-loader.js
git commit -m "Load unified word pack by default."
```

---

## Task 4: Update HTML for Pack and Sessions

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace the source selection section**

Replace the current `#word-source-section` content with:

```html
        <!-- 词包选择 -->
        <div id="word-source-section" class="section">
            <h2>小学英语全部</h2>
            <div class="pack-card">
                <p class="pack-subtitle"><span id="pack-total-count">448</span> 个单词</p>
                <div class="pack-stats">
                    <span>待复习 <strong id="pack-review-count">0</strong></span>
                    <span>新词 <strong id="pack-new-count">0</strong></span>
                    <span>错题 <strong id="pack-mistake-count">0</strong></span>
                </div>
                <div class="session-buttons">
                    <button class="btn btn-primary session-btn" onclick="startSession('quick')">
                        小试牛刀 · 20 词
                    </button>
                    <button class="btn btn-success session-btn" onclick="startSession('challenge')">
                        挑战模式 · 每批 20 词
                    </button>
                </div>
            </div>
        </div>
```

- [ ] **Step 2: Remove the mode switch block from `#practice-section`**

Delete the whole `<div class="mode-switch">...</div>` block.

- [ ] **Step 3: Add challenge end button inside `.control-buttons`**

Add this button after the answer button:

```html
                <button id="end-challenge-button" class="btn btn-warning hidden" onclick="endChallenge()">结束练习</button>
```

- [ ] **Step 4: Expand completion buttons**

Replace the single completion button:

```html
                <button class="btn btn-primary" onclick="backToSource()">继续练习</button>
```

with:

```html
                <div class="complete-actions">
                    <button class="btn btn-primary" onclick="repeatLastSession()">再来一轮</button>
                    <button class="btn btn-secondary" onclick="backToSource()">返回首页</button>
                </div>
```

- [ ] **Step 5: Add the feed builder script**

Change the script block near the bottom to:

```html
    <script src="https://cdnjs.cloudflare.com/ajax/libs/howler/2.2.4/howler.min.js"></script>
    <script src="js/memory.js"></script>
    <script src="js/feed-builder.js"></script>
    <script src="js/data-loader.js"></script>
    <script src="js/sound-effects.js"></script>
    <script src="js/pronunciation.js"></script>
    <script src="js/typing-game.js"></script>
```

- [ ] **Step 6: Auto-load the unified pack**

Add `onload="loadDefaultWordPack()"` to the `<body>` tag:

```html
<body onload="loadDefaultWordPack()">
```

- [ ] **Step 7: Commit this task**

```bash
git add index.html
git commit -m "Update UI for unified word pack sessions."
```

---

## Task 5: Refactor Typing Game to Session Queues

**Files:**
- Modify: `js/typing-game.js`

- [ ] **Step 1: Replace mode state at the top of the file**

Replace:

```javascript
let currentMode = 'learn';
let currentWord = null;
let practiceQueue = [];
let practiceIndex = 0;
let sessionStats = {
    total: 0,
    correct: 0,
    incorrect: 0,
    streak: 0
};
```

with:

```javascript
let sessionType = 'quick';
let lastSessionType = 'quick';
let currentWord = null;
let practiceQueue = [];
let practiceIndex = 0;
let sessionSeen = new Set();
let batchIndex = 1;
let sessionStats = {
    total: 0,
    correct: 0,
    incorrect: 0,
    streak: 0,
    newWords: 0,
    reviewWords: 0,
    mistakeWords: 0
};
```

- [ ] **Step 2: Replace `initPractice()` and remove `switchMode()`**

Delete `initPractice()`, `switchMode(mode)`, and `updateBadges()`.

Add:

```javascript
function createEmptySessionStats() {
    return {
        total: 0,
        correct: 0,
        incorrect: 0,
        streak: 0,
        newWords: 0,
        reviewWords: 0,
        mistakeWords: 0
    };
}

function startSession(type) {
    sessionType = type;
    lastSessionType = type;
    practiceQueue = [];
    practiceIndex = 0;
    sessionSeen = new Set();
    batchIndex = 1;
    sessionStats = createEmptySessionStats();

    showSection('practice-section');
    document.getElementById('end-challenge-button').classList.toggle('hidden', type !== 'challenge');
    loadSessionBatch();
}

function loadSessionBatch() {
    const wordList = getCurrentWordList().map(item => item.word);
    practiceQueue = buildSessionQueue(wordList, { limit: SESSION_SIZE, seen: sessionSeen });
    practiceIndex = 0;

    practiceQueue.forEach(word => {
        sessionSeen.add(word);
    });

    if (practiceQueue.length === 0) {
        showComplete();
        return;
    }

    loadNextWord();
}

function repeatLastSession() {
    startSession(lastSessionType);
}
```

- [ ] **Step 3: Replace `showEmptyState(message)`**

Use:

```javascript
function showEmptyState(message) {
    clearAllTimers();
    document.getElementById('chinese-word').textContent = message;
    document.getElementById('word-input').value = '';
    document.getElementById('word-input').disabled = true;
    document.getElementById('answer-display').classList.add('hidden');
    updateStats();
}
```

- [ ] **Step 4: Replace the queue-complete branch in `loadNextWord()`**

Replace:

```javascript
    if (practiceIndex >= practiceQueue.length) {
        showComplete();
        return;
    }
```

with:

```javascript
    if (practiceIndex >= practiceQueue.length) {
        if (sessionType === 'challenge') {
            batchIndex++;
            loadSessionBatch();
        } else {
            showComplete();
        }
        return;
    }
```

- [ ] **Step 5: Add word type counting in `loadNextWord()`**

After:

```javascript
    const wordRecord = memoryManager.getWord(currentWord);
```

add:

```javascript
    if (wordRecord.totalAttempts === 0) {
        sessionStats.newWords++;
    } else if (wordRecord.errorCount > wordRecord.correctCount) {
        sessionStats.mistakeWords++;
    } else {
        sessionStats.reviewWords++;
    }
```

- [ ] **Step 6: Replace `updateStats()`**

Use:

```javascript
function updateStats() {
    const total = practiceQueue.length || SESSION_SIZE;
    const accuracy = sessionStats.total > 0
        ? Math.round((sessionStats.correct / sessionStats.total) * 100)
        : '-';

    if (sessionType === 'challenge') {
        document.getElementById('progress-text').textContent =
            `第 ${batchIndex} 批 · ${practiceIndex}/${total} · 累计 ${sessionStats.total} 词`;
    } else {
        document.getElementById('progress-text').textContent = `${practiceIndex}/${total}`;
    }

    document.getElementById('accuracy-text').textContent = `${accuracy}%`;
    document.getElementById('streak-text').textContent = sessionStats.streak;

    const progressPercent = total > 0 ? (practiceIndex / total) * 100 : 0;
    document.getElementById('progress-fill').style.width = `${progressPercent}%`;
}
```

- [ ] **Step 7: Replace `recordAnswer(correct, usedHint = false)` tail**

Remove:

```javascript
    updateBadges();
```

Add:

```javascript
    updateStats();
    updatePackOverview();
```

- [ ] **Step 8: Add `endChallenge()` before `showComplete()`**

```javascript
function endChallenge() {
    clearAllTimers();
    showComplete();
}
```

- [ ] **Step 9: Replace `showComplete()` message and stats**

Update the title and stats logic inside `showComplete()`:

```javascript
function showComplete() {
    clearAllTimers();
    showSection('complete-section');

    const accuracy = sessionStats.total > 0
        ? Math.round((sessionStats.correct / sessionStats.total) * 100)
        : 0;

    document.querySelector('#complete-section h2').textContent =
        sessionType === 'challenge' ? '挑战结束！' : '本轮完成！';
    document.getElementById('complete-total').textContent = sessionStats.total;
    document.getElementById('complete-correct').textContent = sessionStats.correct;
    document.getElementById('complete-accuracy').textContent = `${accuracy}%`;

    let message = '完成！';
    if (sessionStats.total === 0) {
        message = '本次还没有练习单词';
    } else if (accuracy >= 90) {
        message = '太棒了！你的正确率很高！🎉';
    } else if (accuracy >= 70) {
        message = '不错！继续加油！💪';
    } else {
        message = '需要多加练习哦 📚';
    }

    document.getElementById('complete-text').textContent = message;
    updatePackOverview();
}
```

- [ ] **Step 10: Replace `backToSource()`**

Use:

```javascript
function backToSource() {
    clearAllTimers();
    currentWord = null;
    document.getElementById('end-challenge-button').classList.add('hidden');
    updatePackOverview();
    showSection('word-source-section');
}
```

- [ ] **Step 11: Verify syntax**

Run:

```bash
node --check js/typing-game.js
```

Expected: no output and exit code 0.

- [ ] **Step 12: Commit this task**

```bash
git add js/typing-game.js
git commit -m "Refactor typing flow to feed sessions."
```

---

## Task 6: Update Styles

**Files:**
- Modify: `css/style.css`

- [ ] **Step 1: Replace `.word-source-buttons` styles with pack/session styles**

Replace:

```css
.word-source-buttons {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
}
```

with:

```css
.pack-card {
    max-width: 560px;
    margin: 0 auto;
    padding: 28px 20px;
    border-top: var(--hairline);
    border-bottom: var(--hairline);
    text-align: center;
}

.pack-subtitle {
    color: var(--text-secondary);
    margin-bottom: 16px;
}

.pack-stats {
    display: flex;
    justify-content: center;
    gap: 24px;
    flex-wrap: wrap;
    margin-bottom: 24px;
    color: var(--text-secondary);
    font-size: 14px;
}

.pack-stats strong {
    color: var(--text-primary);
    font-weight: normal;
}

.session-buttons {
    display: flex;
    justify-content: center;
    gap: 16px;
    flex-wrap: wrap;
}

.session-btn {
    min-width: 180px;
}
```

- [ ] **Step 2: Remove mode styles after HTML no longer uses them**

Delete the CSS block from `/* ==================== 模式切换 ==================== */` through the `.badge` rule.

- [ ] **Step 3: Add completion action styles after `.complete-stats` rules**

```css
.complete-actions {
    display: flex;
    justify-content: center;
    gap: 16px;
    flex-wrap: wrap;
}
```

- [ ] **Step 4: Add mobile behavior inside the existing media query**

Add inside `@media (max-width: 600px)`:

```css
    .session-buttons {
        flex-direction: column;
    }

    .pack-stats {
        flex-direction: column;
        gap: 10px;
    }
```

- [ ] **Step 5: Commit this task**

```bash
git add css/style.css
git commit -m "Style unified pack session UI."
```

---

## Task 7: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the multi-source feature bullet**

Change:

```markdown
- 📚 **多单词源支持**: 支持小学英语单词1、2、3（共448个单词）
```

to:

```markdown
- 📚 **统一小学词包**: 默认使用全部 448 个小学英语单词
```

- [ ] **Step 2: Replace the practice mode section**

Replace the old `## 练习模式` content through the duplicate wrong-book section with:

```markdown
## 练习档位

### 小试牛刀
- 每轮固定目标 20 个单词
- 系统自动混合到期复习、新词和错题加权词
- 适合碎片时间快速练习

### 挑战模式
- 每批 20 个单词
- 练完一批后自动续下一批
- 支持随时点击「结束练习」

## Feed 排词策略

- 目标比例为 12 个复习词 + 8 个新词
- 错题会在复习位中优先出现
- 词池不足 20 个时，会使用实际可练数量结束本轮
```

- [ ] **Step 3: Update keyboard shortcuts**

Keep:

```markdown
- `Enter` - 显示答案 / 下一个单词
- `Tab` - 跳过当前单词
- `Esc` - 返回首页
```

- [ ] **Step 4: Commit this task**

```bash
git add README.md
git commit -m "Document unified feed practice flow."
```

---

## Task 8: Manual Verification

**Files:**
- No code changes unless a defect is found.

- [ ] **Step 1: Start the static server**

Run:

```bash
python -m http.server 8000
```

Expected: server starts on `http://localhost:8000`.

- [ ] **Step 2: Open the app**

Open:

```text
http://localhost:8000
```

Expected:
- One pack card is visible.
- Two buttons are visible: `小试牛刀 · 20 词` and `挑战模式 · 每批 20 词`.
- Old `9.xml` / `10.xml` / `11.xml` buttons are gone.
- Old learning/review/mistake tabs are gone.

- [ ] **Step 3: Test quick mode**

Actions:
- Click `小试牛刀 · 20 词`.
- Complete or skip a few words.
- Use `Enter` to show answer and proceed.

Expected:
- Progress displays like `0/20`, `1/20`.
- Answer panel still displays after learning cards.
- Completion page appears after the batch ends.

- [ ] **Step 4: Test challenge mode**

Actions:
- Return home.
- Click `挑战模式 · 每批 20 词`.
- Complete or skip words until the second batch begins, or use `结束练习`.

Expected:
- Progress displays like `第 1 批 · 0/20 · 累计 0 词`.
- `结束练习` is visible only in challenge mode.
- Ending challenge shows the completion page.

- [ ] **Step 5: Check browser console**

Expected:
- No `ReferenceError`.
- No missing `feed-builder.js`.
- No missing DOM id errors.

- [ ] **Step 6: Final status check**

Run:

```bash
git status --short
```

Expected: clean working tree if all planned commits were made.

---

## Self-Review

- Spec coverage: The plan covers unified pack loading, two session buttons, 20-word quick practice, 20-word challenge batches, feed selection, challenge manual ending, UI changes, README updates, and manual verification.
- Placeholder scan: No placeholder instructions remain. Every code-changing step includes concrete code or a concrete replacement target.
- Type consistency: `sessionType`, `lastSessionType`, `sessionSeen`, `batchIndex`, `buildSessionQueue`, `SESSION_SIZE`, and `updatePackOverview` names are used consistently across tasks.
