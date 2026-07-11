/**
 * 打字游戏主逻辑
 */

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    updateSoundIcon();
    updatePronunciationIcon();
    initTheme();
    // 首次创建图标
});

// 游戏状态
let sessionType = 'quick';
let lastSessionType = 'quick';
let currentWord = null;
let practiceQueue = [];
let practiceIndex = 0;
let sessionSeen = new Set();
let sessionPracticed = new Set();
let batchIndex = 1;
let currentBatchSize = 0;
let sessionEnded = false;
let answerAdvanceTimer = null;
let sessionStats = {
    total: 0,
    correct: 0,
    incorrect: 0,
    streak: 0,
    newWords: 0,
    reviewWords: 0,
    mistakeWords: 0
};

// 智能提示相关
let idleTimer = null;           // 检测用户是否停止输入
let hintTimer = null;           // 显示提示的定时器
let learningCardTimer = null;    // 30秒学习卡片定时器
let cardAutoHideTimer = null;    // 学习卡自动隐藏的定时器
let isAnswerLocked = false;      // 学习卡是否处于锁定显示（30秒卡 / Enter 强制显示）
let alwaysShowAnswer = false;    // 「显示答案」开关：开启后每个单词都常驻显示学习卡
let hintIndex = 0;               // 当前提示到第几个字母
let usedHints = false;           // 是否使用了提示（含查看过学习卡）
let lastInputLength = 0;         // 上次输入长度
let lastInputTime = 0;           // 上次输入时间
let isShowingHint = false;       // 是否正在显示提示

// 提示配置
const HINT_DELAY = 8000;         // 8秒无输入开始提示（毫秒）
const HINT_INTERVAL = 5000;       // 每5秒显示一个新字母
const LEARNING_CARD_DELAY = 30000; // 30秒后显示学习卡片

/**
 * 显示指定的区块
 */
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('hidden');
    });
    document.getElementById(sectionId).classList.remove('hidden');
}

/**
 * 清除所有定时器
 */
function clearAllTimers() {
    if (idleTimer) clearTimeout(idleTimer);
    if (hintTimer) clearTimeout(hintTimer);
    if (learningCardTimer) clearTimeout(learningCardTimer);
    if (answerAdvanceTimer) clearTimeout(answerAdvanceTimer);
    clearCardDisplayTimers();
    idleTimer = null;
    hintTimer = null;
    learningCardTimer = null;
    answerAdvanceTimer = null;
}

/**
 * 清除学习卡区域的自动隐藏 / 自动前进定时器
 */
function clearCardDisplayTimers() {
    if (cardAutoHideTimer) clearTimeout(cardAutoHideTimer);
    cardAutoHideTimer = null;
}

/**
 * 创建空的 session 统计
 */
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

function persistSessionPractice() {
    if (sessionPracticed.size === 0) return;
    memoryManager.recordRecentPractice([...sessionPracticed]);
}

/**
 * 开始练习 session
 */
function startSession(type) {
    sessionType = type;
    lastSessionType = type;
    practiceQueue = [];
    practiceIndex = 0;
    sessionSeen = new Set();
    sessionPracticed = new Set();
    batchIndex = 1;
    sessionEnded = false;
    sessionStats = createEmptySessionStats();
    alwaysShowAnswer = false;
    updatePeekToggleUI();

    showSection('practice-section');
    document.getElementById('end-challenge-button').classList.toggle('hidden', type !== 'challenge');
    loadSessionBatch();
}

/**
 * 加载一批练习单词
 */
function loadSessionBatch() {
    const wordList = getCurrentWordList().map(item => item.word);
    practiceQueue = buildSessionQueue(wordList, { limit: SESSION_SIZE, seen: sessionSeen });
    practiceIndex = 0;
    currentBatchSize = practiceQueue.length;

    practiceQueue.forEach(word => {
        sessionSeen.add(word);
    });

    if (practiceQueue.length === 0) {
        showComplete({ poolExhausted: sessionStats.total > 0 });
        return;
    }

    loadNextWord();
}

/**
 * 再来一轮
 */
function repeatLastSession() {
    startSession(lastSessionType);
}

/**
 * 显示空状态
 */
function showEmptyState(message) {
    clearAllTimers();
    document.getElementById('chinese-word').textContent = message;
    document.getElementById('word-input').value = '';
    document.getElementById('word-input').disabled = true;
    document.getElementById('answer-display').classList.add('hidden');
    updateStats();
}

/**
 * 加载下一个单词
 */
function loadNextWord() {
    if (sessionEnded) return;

    if (practiceIndex >= practiceQueue.length) {
        if (sessionType === 'challenge') {
            batchIndex++;
            loadSessionBatch();
        } else {
            showComplete();
        }
        return;
    }

    // 清除之前的定时器
    clearAllTimers();

    // 重置提示状态
    hintIndex = 0;
    usedHints = false;
    isAnswerLocked = false;
    lastInputLength = 0;
    lastInputTime = Date.now();
    isShowingHint = false;

    currentWord = practiceQueue[practiceIndex];
    const wordObj = getWordObject(currentWord);

    // 显示中文
    document.getElementById('chinese-word').textContent = wordObj.meaning;
    document.getElementById('word-input').value = '';
    document.getElementById('word-input').disabled = false;
    document.getElementById('word-input').classList.remove('correct', 'incorrect');
    document.getElementById('word-input').focus();
    const feedback = document.getElementById('input-feedback');
    feedback.classList.remove('feedback-correct', 'feedback-incorrect');
    updateInputFeedback();
    clearAnswerCard();

    // 播放单词发音
    pronunciationManager.play(currentWord);
    
    // 显示发音重播按钮
    const replayBtn = document.getElementById('replay-pronunciation-btn');
    if (replayBtn) {
        if (pronunciationManager.isEnabled()) {
            replayBtn.classList.remove('hidden');
        } else {
            replayBtn.classList.add('hidden');
        }
    }

    if (alwaysShowAnswer) {
        // 常显模式：直接展示该词学习卡，不需要新词预览或智能提示
        showPersistentAnswerCard();
    } else {
        const wordRecord = memoryManager.getWord(currentWord);
        if (wordRecord && wordRecord.totalAttempts === 0) {
            // 新单词：先显示答案让用户学习
            setTimeout(() => {
                if (!sessionEnded && currentWord === wordObj.word) {
                    showLearningMode(currentWord);
                }
            }, 300);
        }
        // 启动提示定时器
        startHintSystem();
    }

    updateStats();
}

/**
 * 启动智能提示系统
 */
function startHintSystem() {
    if (alwaysShowAnswer) return; // 常显模式下无需智能提示

    const target = currentWord ? currentWord.toLowerCase() : '';

    // 8秒无输入后开始提示
    idleTimer = setTimeout(() => {
        if (!usedHints && currentWord) {
            showNextHint();
            // 之后每5秒显示一个新字母
            hintTimer = setInterval(() => {
                if (currentWord && hintIndex < target.length) {
                    showNextHint();
                }
            }, HINT_INTERVAL);
        }
    }, HINT_DELAY);

    // 30秒后显示学习卡片
    learningCardTimer = setTimeout(() => {
        if (currentWord && !isWordCorrect()) {
            showLearningCard(currentWord);
        }
    }, LEARNING_CARD_DELAY);
}

/**
 * 检查当前单词是否已正确输入
 */
function isWordCorrect() {
    const input = document.getElementById('word-input');
    if (!input || !currentWord) return false;
    return input.value.trim().toLowerCase() === currentWord.toLowerCase();
}

/**
 * 显示下一个字母提示
 */
function showNextHint() {
    if (!currentWord) return;

    const target = currentWord.toLowerCase();
    const input = document.getElementById('word-input');
    const currentValue = input.value.trim().toLowerCase();

    // 找到第一个需要提示的位置
    let pos = currentValue.length;
    while (pos < target.length && currentValue[pos] === target[pos]) {
        pos++;
    }

    if (pos < target.length) {
        hintIndex = pos;
        usedHints = true;
        isShowingHint = true;

        // 在输入框中显示提示
        const newValue = target.substring(0, pos + 1);
        input.value = newValue;
        input.classList.add('hint-mode');

        // 更新反馈显示
        updateInputFeedback();
    }
}

/**
 * 生成学习卡 HTML（无 continueHandler 时为纯预览卡，不含按钮）
 */
function buildLearningCardHTML(word, { badgeText, hintText, continueHandler, continueLabel }) {
    const wordObj = getWordObject(word);
    const buttonHTML = continueHandler
        ? `<button class="btn btn-primary" onclick="${continueHandler}">${continueLabel}</button>`
        : '';
    return `
        <div class="learning-card permanent">
            <div class="learning-card-badge">${badgeText}</div>
            <div class="word-pair-large">
                <div class="word-item-large">
                    <span class="label">中文</span>
                    <span class="chinese-large">${wordObj.meaning}</span>
                </div>
                <div class="arrow-large">→</div>
                <div class="word-item-large">
                    <span class="label">英文</span>
                    <span class="english-large">${word}</span>
                </div>
            </div>
            <p class="learning-card-hint">${hintText}</p>
            ${buttonHTML}
        </div>
    `;
}

/**
 * 判断鼠标当前是否仍停在「显示答案」按钮或学习卡区域内
 */
function isPeekAreaHovered() {
    const btn = document.getElementById('peek-answer-btn');
    const card = document.getElementById('answer-display');
    return (btn && btn.matches(':hover')) || (card && card.matches(':hover'));
}

/**
 * 彻底隐藏并清空答案区域（学习卡的默认隐藏方式）
 */
function clearAnswerCard() {
    const card = document.getElementById('answer-display');
    card.classList.add('hidden');
    card.classList.remove('learning-card-area');
    card.onmouseenter = null;
    card.onmouseleave = null;
    card.innerHTML = '';
}

/**
 * 安排隐藏学习卡：用极短缓冲（150ms）处理按钮与卡片之间的间隙，
 * 避免鼠标从按钮移向卡片途中经过空隙而被误判为「移出」。
 * 到点时若鼠标仍在「按钮 + 卡片」区域内的任意位置，则不隐藏。
 */
function scheduleCardHide(hideFn) {
    clearCardDisplayTimers();
    cardAutoHideTimer = setTimeout(() => {
        if (isAnswerLocked || alwaysShowAnswer || isPeekAreaHovered()) return;
        hideFn();
    }, 150);
}

/**
 * 挂载学习卡到答案区域
 * - 只要学习卡显示，就把当前单词标记为「看过答案」（usedHints=true），本次即使拼对也不算掌握
 * - options.locked 为 true 时锁定显示（点击显示答案 / 30 秒卡），鼠标移开不隐藏，需点按钮继续
 * - 否则为预览卡：鼠标悬停在「按钮 + 卡片」区域内任意位置都保持显示，
 *   完全移出后触发 options.onAutoHide（默认直接隐藏）；
 *   若指定 options.autoHideDelay，还会在挂载后该时长自动尝试隐藏一次（新词预览用）
 */
function mountLearningCard(word, options = {}) {
    const answerDisplay = document.getElementById('answer-display');
    clearCardDisplayTimers();

    // 看过学习卡即视为未完全掌握
    usedHints = true;

    answerDisplay.innerHTML = buildLearningCardHTML(word, options);
    answerDisplay.classList.remove('hidden');
    answerDisplay.classList.add('learning-card-area');

    if (options.locked) {
        isAnswerLocked = true;
        answerDisplay.onmouseenter = null;
        answerDisplay.onmouseleave = null;
        return;
    }

    const hideFn = options.onAutoHide || clearAnswerCard;
    answerDisplay.onmouseenter = () => clearCardDisplayTimers();
    answerDisplay.onmouseleave = () => scheduleCardHide(hideFn);

    if (options.autoHideDelay) {
        cardAutoHideTimer = setTimeout(() => {
            if (alwaysShowAnswer || isPeekAreaHovered()) return;
            hideFn();
        }, options.autoHideDelay);
    }
}

/**
 * 悬停「显示答案」按钮时预览学习卡（想不起来时查看）
 * 注意：不要用 isWordCorrect() 拦截——提示系统会用 JS 直接给输入框赋值
 * （不触发 oninput），此时输入框内容可能已等于目标单词，但用户并未真正
 * 确认输入，此时仍应允许悬停查看答案。
 */
function peekAnswer() {
    // 常显模式下卡片本就一直显示，悬停无需额外动作
    if (!currentWord || isAnswerLocked || alwaysShowAnswer) return;

    mountLearningCard(currentWord, {
        badgeText: '<img src="assets/icons/lightbulb.png" alt="hint" class="oil-icon icon-inline" /> 学习提示',
        hintText: '想不起来就看一眼，记住后移开鼠标继续拼写'
    });
}

/**
 * 鼠标移开「显示答案」按钮时尝试隐藏预览学习卡
 */
function hidePeekAnswer() {
    // 常显模式下不应被隐藏
    if (isAnswerLocked || alwaysShowAnswer) return;
    scheduleCardHide(clearAnswerCard);
}

/**
 * 常显模式：为当前单词展示常驻学习卡（不锁定、无需继续按钮，鼠标移开也不隐藏）
 */
function showPersistentAnswerCard() {
    if (!currentWord) return;

    mountLearningCard(currentWord, {
        badgeText: '<img src="assets/icons/eye.png" alt="eye" class="oil-icon icon-inline" /> 常显模式',
        hintText: '已开启「显示答案」常显模式，再次点击按钮可关闭'
    });

    // 常显模式下卡片应始终可见，不受鼠标悬停/移开影响
    const answerDisplay = document.getElementById('answer-display');
    answerDisplay.onmouseenter = null;
    answerDisplay.onmouseleave = null;
}

/**
 * 切换「显示答案」常显开关
 * 开启：当前单词及后续每个单词都会常驻显示学习卡，同时暂停智能提示/30秒卡等机制
 * 关闭：恢复默认状态，不干扰悬停预览与智能提示/30秒卡机制
 */
function toggleAlwaysShowAnswer() {
    alwaysShowAnswer = !alwaysShowAnswer;
    updatePeekToggleUI();

    if (alwaysShowAnswer) {
        clearAllTimers();
        isAnswerLocked = false;
        showPersistentAnswerCard();
    } else {
        clearAnswerCard();
        isAnswerLocked = false;
        // 注意：不重置 usedHints——本词若已在常显模式下被看过，仍算「未完全掌握」
        if (currentWord) {
            startHintSystem();
        }
    }
}

/**
 * 更新「显示答案」按钮的开关视觉状态
 */
function updatePeekToggleUI() {
    const btn = document.getElementById('peek-answer-btn');
    if (!btn) return;
    btn.classList.toggle('btn-toggle-active', alwaysShowAnswer);
    btn.textContent = alwaysShowAnswer ? '答案常显' : '显示答案';
    btn.title = alwaysShowAnswer ? '常显模式已开启，点击关闭' : '悬停即可查看答案，点击开启常显模式';
    btn.setAttribute('aria-pressed', alwaysShowAnswer ? 'true' : 'false');
    btn.setAttribute('aria-label', alwaysShowAnswer ? '关闭答案常显模式' : '显示答案');
}

/**
 * 显示学习卡片（30秒卡住时）
 */
function showLearningCard(word) {
    clearAllTimers();

    mountLearningCard(word, {
        badgeText: '<img src="assets/icons/lightbulb.png" alt="hint" class="oil-icon icon-inline" /> 学习提示',
        hintText: '这个单词需要多加练习哦',
        continueHandler: 'continueFromLearningCard()',
        continueLabel: '我学会了，继续练习',
        locked: true
    });
}

/**
 * 从学习卡片继续（30秒卡住）
 */
function continueFromLearningCard() {
    if (sessionEnded) return;
    clearCardDisplayTimers();
    isAnswerLocked = false;
    recordAnswer(false, true);
    practiceIndex++;
    loadNextWord();
}

/**
 * 显示学习模式（新单词先学习）——预览卡，3 秒后若鼠标不在「按钮+卡片」区域则自动隐藏
 */
function showLearningMode(word) {
    mountLearningCard(word, {
        badgeText: '<img src="assets/icons/book.png" alt="book" class="oil-icon icon-inline" /> 新单词学习',
        hintText: '先记住这个单词，然后试着输入它',
        autoHideDelay: 3000,
        onAutoHide: () => {
            if (alwaysShowAnswer) return;
            if (currentWord === word && !document.getElementById('word-input').value) {
                clearAnswerCard();
            }
        }
    });
}

/**
 * 更新输入反馈：仅显示剩余字母占位，不重复输入框内容
 */
function updateInputFeedback() {
    const input = document.getElementById('word-input');
    const value = input.value.trim().toLowerCase();
    const feedback = document.getElementById('input-feedback');

    if (!currentWord) return;

    const target = currentWord.toLowerCase();
    const remaining = target.length - value.length;

    if (remaining <= 0) {
        feedback.innerHTML = '';
        return;
    }

    feedback.innerHTML = Array.from({ length: remaining }, () =>
        '<span class="char-empty">_</span>'
    ).join('');
}

/**
 * 格式化练习进度文本
 */
function formatSessionProgress({ sessionType, batchIndex, practiceIndex, total, sessionTotal }) {
    if (sessionType === 'challenge') {
        return `第 ${batchIndex} 批 · ${practiceIndex}/${total} · 累计 ${sessionTotal} 词`;
    }
    return `${practiceIndex}/${total}`;
}

/**
 * 格式化正确率文本（无答题时返回 "-"，避免出现 "-%"）
 */
function formatSessionAccuracy({ correct, total }) {
    if (total <= 0) return '-';
    return `${Math.round((correct / total) * 100)}%`;
}

/**
 * 计算进度条百分比
 */
function computeProgressPercent(practiceIndex, total) {
    if (total <= 0) return 0;
    return (practiceIndex / total) * 100;
}

/**
 * 生成供屏幕阅读器播报的统计摘要
 */
function buildStatsLiveSummary({ sessionType, batchIndex, practiceIndex, total, sessionStats }) {
    const progress = formatSessionProgress({
        sessionType,
        batchIndex,
        practiceIndex,
        total,
        sessionTotal: sessionStats.total
    });
    const accuracy = formatSessionAccuracy({
        correct: sessionStats.correct,
        total: sessionStats.total
    });
    return `进度 ${progress}，正确率 ${accuracy}，连续正确 ${sessionStats.streak}`;
}

/**
 * 更新统计信息
 */
function updateStats() {
    const total = practiceQueue.length || SESSION_SIZE;
    const progressText = formatSessionProgress({
        sessionType,
        batchIndex,
        practiceIndex,
        total,
        sessionTotal: sessionStats.total
    });
    const accuracyText = formatSessionAccuracy({
        correct: sessionStats.correct,
        total: sessionStats.total
    });

    document.getElementById('progress-text').textContent = progressText;
    document.getElementById('accuracy-text').textContent = accuracyText;
    document.getElementById('streak-text').textContent = sessionStats.streak;

    const progressPercent = computeProgressPercent(practiceIndex, total);
    document.getElementById('progress-fill').style.width = `${progressPercent}%`;

    const progressBar = document.querySelector('.progress-bar[role="progressbar"]');
    if (progressBar) {
        progressBar.setAttribute('aria-valuenow', String(Math.round(progressPercent)));
    }

    const liveEl = document.getElementById('stats-live');
    if (liveEl) {
        liveEl.textContent = buildStatsLiveSummary({
            sessionType,
            batchIndex,
            practiceIndex,
            total,
            sessionStats
        });
    }
}

/**
 * 检查用户输入
 */
function checkInput() {
    const input = document.getElementById('word-input');
    const value = input.value.trim().toLowerCase();

    if (!currentWord) return;

    const target = currentWord.toLowerCase();
    const now = Date.now();

    // 检测用户是否在输入
    if (value.length !== lastInputLength) {
        // 初始化音效（首次用户交互）
        soundManager.init();

        // 播放按键音效
        soundManager.playKeyPress();

        // 用户有输入，重置空闲定时器
        lastInputLength = value.length;
        lastInputTime = now;

        // 清除原有的字母提示定时器，重新开始（常显模式下不启动）
        if (idleTimer) clearTimeout(idleTimer);
        if (hintTimer) clearTimeout(hintTimer);

        if (!alwaysShowAnswer) {
            idleTimer = setTimeout(() => {
                if (!usedHints && currentWord && !isWordCorrect()) {
                    showNextHint();
                    hintTimer = setInterval(() => {
                        if (currentWord && hintIndex < target.length && !isWordCorrect()) {
                            showNextHint();
                        }
                    }, HINT_INTERVAL);
                }
            }, HINT_DELAY);
        }
    }

    // 实时检查每个字母是否正确
    for (let i = 0; i < value.length; i++) {
        if (value[i] !== target[i]) {
            // 发现错误字母，立即清空并重置
            input.value = '';
            lastInputLength = 0;
            input.classList.add('incorrect');
            input.classList.remove('correct');

            // 播放错误音效
            soundManager.playIncorrect();

            // 震动反馈（如果支持）
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }

            // 短暂延迟后移除错误状态
            setTimeout(() => {
                input.classList.remove('incorrect');
            }, 300);

            // 更新反馈显示为空
            updateInputFeedback();
            return;
        }
    }

    // 更新输入反馈
    updateInputFeedback();

    // 检查是否完整输入
    if (value === target && value.length === target.length) {
        // 正确
        input.classList.remove('incorrect', 'hint-mode');
        input.classList.add('correct');
        const feedback = document.getElementById('input-feedback');
        feedback.classList.add('feedback-correct');
        feedback.innerHTML = usedHints ? '<img src="assets/icons/check.png" alt="check" class="oil-icon icon-inline" /> 正确！（使用了提示）' : '<img src="assets/icons/check.png" alt="check" class="oil-icon icon-inline" /> 正确！';

        // 播放正确音效
        soundManager.playCorrect();

        // 记录结果
        recordAnswer(true, usedHints);

        // 短暂延迟后进入下一个
        answerAdvanceTimer = setTimeout(() => {
            answerAdvanceTimer = null;
            if (sessionEnded) return;
            practiceIndex++;
            loadNextWord();
        }, 800);

    } else {
        // 还在输入中，保持正确状态
        input.classList.remove('correct', 'incorrect');
        document.getElementById('input-feedback').classList.remove('feedback-correct', 'feedback-incorrect');
    }
}

function recordWordCategory() {
    const wordRecord = memoryManager.getWord(currentWord);
    if (wordRecord.totalAttempts === 0) {
        sessionStats.newWords++;
    } else if (wordRecord.errorCount > wordRecord.correctCount) {
        sessionStats.mistakeWords++;
    } else {
        sessionStats.reviewWords++;
    }
}

/**
 * 记录答题结果
 * @param {boolean} correct - 是否正确
 * @param {boolean} usedHint - 是否使用了提示
 */
function recordAnswer(correct, usedHint = false) {
    if (!currentWord || sessionEnded) return;

    sessionPracticed.add(currentWord);
    sessionStats.total++;
    recordWordCategory();
    if (correct) {
        // 使用了提示就算正确，但不能算完全掌握
        if (usedHint) {
            // 提示后的正确只算半对
            sessionStats.correct++;
            // 记录时标记为使用了提示
            memoryManager.recordResultWithHint(currentWord, true);
        } else {
            sessionStats.correct++;
            sessionStats.streak++;
            memoryManager.recordResult(currentWord, true);
        }
    } else {
        sessionStats.incorrect++;
        sessionStats.streak = 0;
        memoryManager.recordResult(currentWord, false);
    }

    updateStats();
    updatePackOverview();
}

/**
 * 处理键盘事件
 */
function handleKeydown(event) {
    const answerDisplay = document.getElementById('answer-display');
    const isAnswerVisible = !answerDisplay.classList.contains('hidden');

    if (event.key === 'Enter') {
        // 仅 30 秒锁定卡有「继续」按钮；悬停预览 / 常显模式不拦截 Enter
        const continueBtn = answerDisplay.querySelector('.learning-card .btn-primary');
        if (isAnswerVisible && continueBtn && isAnswerLocked) {
            continueBtn.click();
        }
    } else if (event.key === 'Escape') {
        backToSource();
    }
}

/**
 * 结束挑战模式
 */
function endChallenge() {
    if (sessionEnded) return;
    sessionEnded = true;
    clearAllTimers();
    showComplete();
}

/**
 * 安全写入小结页 DOM 文本
 */
function setCompleteText(id, value, fallbackSelector) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = value;
        return;
    }
    if (fallbackSelector) {
        const fallback = document.querySelector(fallbackSelector);
        if (fallback) fallback.textContent = value;
    }
}

/**
 * 计算本次 session 涉及的批次数
 * @param {object} [state] - 可选状态快照，便于 Node 回归测试注入
 */
function getSessionBatchCount(state = {}) {
    const stats = state.sessionStats ?? sessionStats;
    const queue = state.practiceQueue ?? practiceQueue;
    const index = state.practiceIndex ?? practiceIndex;
    const batch = state.batchIndex ?? batchIndex;

    if (stats.total === 0) return 0;
    if (queue.length === 0 && index === 0 && batch > 1) {
        return batch - 1;
    }
    return batch;
}

/**
 * 生成小结页鼓励文案（纯文本，供 aria-live 使用）
 */
function buildCompleteMessage({ poolExhausted, stats, accuracy }) {
    if (poolExhausted) {
        return '太棒了，暂无更多待练单词！';
    }
    if (stats.total === 0) {
        return '本次还没有练习单词';
    }
    if (accuracy >= 90) {
        return '太棒了！你的正确率很高！';
    }
    if (accuracy >= 70) {
        return '不错！继续加油！';
    }
    return '需要多加练习哦';
}

/**
 * 为视觉小结文案追加 Lucide 图标
 */
function decorateCompleteMessageHTML(message) {
    if (message.includes('暂无更多待练单词') || message.includes('正确率很高')) {
        return `${message}<img src="assets/icons/party-popper.png" alt="celebrate" class="oil-icon icon-inline" />`;
    }
    if (message.includes('继续加油')) {
        return `${message}<img src="assets/icons/award.png" alt="award" class="oil-icon icon-inline" />`;
    }
    if (message.includes('多加练习')) {
        return `${message} <img src="assets/icons/book-open.png" alt="study" class="oil-icon icon-inline" />`;
    }
    return message;
}

/**
 * 生成小结页批次说明
 */
function buildCompleteBatchInfo({ sessionType, stats, batches, currentBatchSize, sessionSize }) {
    if (sessionType === 'challenge' && stats.total > 0) {
        return `共练习 ${batches} 批 · 累计 ${stats.total} 词`;
    }
    if (sessionType === 'quick' && currentBatchSize > 0 && currentBatchSize < sessionSize) {
        return `本批 ${currentBatchSize} 词`;
    }
    return '';
}

/**
 * 生成供屏幕阅读器播报的小结摘要
 */
function buildCompleteLiveSummary({ title, message, batchInfo, stats, accuracy }) {
    const parts = [title];
    if (message) parts.push(message);
    if (batchInfo) parts.push(batchInfo);
    parts.push(
        `总单词 ${stats.total}，正确 ${stats.correct}，正确率 ${accuracy}%`,
        `新词 ${stats.newWords}，复习 ${stats.reviewWords}，错题 ${stats.mistakeWords}`
    );
    return parts.join('，');
}

/**
 * 显示 Session 小结页
 * @param {object} options
 * @param {boolean} options.poolExhausted - 词池是否已耗尽
 */
function showComplete({ poolExhausted = false } = {}) {
    sessionEnded = true;
    clearAllTimers();

    if (sessionPracticed.size > 0) {
        persistSessionPractice();
    }

    const stats = { ...sessionStats };
    showSection('complete-section');

    const accuracy = stats.total > 0
        ? Math.round((stats.correct / stats.total) * 100)
        : 0;

    const title = sessionType === 'challenge' ? '挑战结束！' : '本轮完成！';
    setCompleteText('complete-title', title, '#complete-section h2');
    setCompleteText('complete-total', stats.total);
    setCompleteText('complete-correct', stats.correct);
    setCompleteText('complete-accuracy', `${accuracy}%`);
    setCompleteText('complete-new', stats.newWords);
    setCompleteText('complete-review', stats.reviewWords);
    setCompleteText('complete-mistake', stats.mistakeWords);

    const batches = getSessionBatchCount();
    const batchInfo = buildCompleteBatchInfo({
        sessionType,
        stats,
        batches,
        currentBatchSize,
        sessionSize: SESSION_SIZE
    });

    const batchInfoEl = document.getElementById('complete-batch-info');
    if (batchInfoEl) {
        if (batchInfo) {
            batchInfoEl.textContent = batchInfo;
            batchInfoEl.classList.remove('hidden');
        } else {
            batchInfoEl.classList.add('hidden');
            batchInfoEl.textContent = '';
        }
    }

    const message = buildCompleteMessage({ poolExhausted, stats, accuracy });

    const completeTextEl = document.getElementById('complete-text');
    if (completeTextEl) completeTextEl.innerHTML = decorateCompleteMessageHTML(message);

    const completeLiveEl = document.getElementById('complete-live');
    if (completeLiveEl) {
        completeLiveEl.textContent = buildCompleteLiveSummary({
            title,
            message,
            batchInfo,
            stats,
            accuracy
        });
    }

    updatePackOverview();
}

/**
 * 返回单词源选择
 */
function backToSource() {
    sessionEnded = true;
    clearAllTimers();
    persistSessionPractice();
    alwaysShowAnswer = false;
    isAnswerLocked = false;
    updatePeekToggleUI();
    clearAnswerCard();
    currentWord = null;
    document.getElementById('end-challenge-button').classList.add('hidden');
    updatePackOverview();
    showSection('word-source-section');
}

/**
 * 返回练习
 */
function backToPractice() {
    showSection('practice-section');
}

// 添加输入反馈样式
const style = document.createElement('style');
style.textContent = `
.input-feedback {
    font-family: 'SF Mono', 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 18px;
    letter-spacing: 0.15em;
    margin-top: 10px;
    min-height: 30px;
}
.char-empty {
    color: var(--text-tertiary);
}
.hint-mode {
    border-color: var(--accent-primary) !important;
}
/* 学习卡片样式 */
.learning-card {
    text-align: center;
    animation: fadeIn 0.4s ease;
}
.learning-card.permanent {
    background: var(--bg-paper-warm);
    padding: 25px;
    margin: 20px 0;
}
.learning-card-badge {
    display: inline-block;
    color: var(--accent-primary);
    padding: 4px 12px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 15px;
}
.word-pair-large {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
    margin: 20px 0;
}
.word-item-large {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.word-item-large .label {
    font-size: 12px;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.chinese-large {
    font-size: 26px;
    font-weight: normal;
    color: var(--text-primary);
}
.english-large {
    font-size: 28px;
    font-weight: normal;
    color: var(--text-primary);
    font-family: 'SF Mono', 'Consolas', 'Monaco', 'Courier New', monospace;
    letter-spacing: 0.05em;
}
.arrow-large {
    color: var(--text-tertiary);
    font-size: 24px;
}
.learning-card-hint {
    color: var(--text-secondary);
    font-size: 14px;
    margin: 15px 0 20px;
}
`;
document.head.appendChild(style);

/**
 * 切换音效开关
 */
function toggleSound() {
    soundManager.toggle();
    updateSoundIcon();
}

/**
 * 更新音效图标
 */
function updateSoundIcon() {
    const button = document.getElementById('sound-toggle');
    const container = document.getElementById('sound-icon-container');
    if (container) {
        const isEnabled = soundManager.isEnabled();
        container.innerHTML = `<img src="assets/icons/${isEnabled ? 'volume-2' : 'volume-x'}.png" alt="sound" class="oil-icon" />`;
    }
    if (button) {
        const isEnabled = soundManager.isEnabled();
        button.setAttribute('aria-label', isEnabled ? '关闭音效' : '开启音效');
        button.setAttribute('aria-pressed', isEnabled ? 'true' : 'false');
    }
}

/**
 * 切换发音开关
 */
function togglePronunciation() {
    pronunciationManager.toggle();
    updatePronunciationIcon();
    
    // 同步更新重播按钮可见性
    const replayBtn = document.getElementById('replay-pronunciation-btn');
    if (replayBtn) {
        if (pronunciationManager.isEnabled()) {
            replayBtn.classList.remove('hidden');
        } else {
            replayBtn.classList.add('hidden');
        }
    }
}

/**
 * 重新播放当前单词发音
 */
function replayPronunciation() {
    if (typeof currentWord !== 'undefined' && currentWord) {
        // 给按钮添加按压动画反馈
        const btn = document.getElementById('replay-pronunciation-btn');
        if (btn) {
            btn.style.transform = 'translateY(0) scale(0.95)';
            setTimeout(() => {
                btn.style.transform = '';
            }, 150);
        }
        pronunciationManager.play(currentWord);
        
        // 播放后自动焦点移回输入框
        const input = document.getElementById('word-input');
        if (input && !input.disabled) {
            input.focus();
        }
    }
}

/**
 * 更新发音图标
 */
function updatePronunciationIcon() {
    const button = document.getElementById('pronunciation-toggle');
    const container = document.getElementById('pronunciation-icon-container');
    if (container) {
        const isEnabled = pronunciationManager.isEnabled();
        container.innerHTML = `<img src="assets/icons/${isEnabled ? 'audio-lines' : 'volume-x'}.png" alt="audio" class="oil-icon" />`;
    }
    if (button) {
        const isEnabled = pronunciationManager.isEnabled();
        button.setAttribute('aria-label', isEnabled ? '关闭发音' : '开启发音');
        button.setAttribute('aria-pressed', isEnabled ? 'true' : 'false');
    }
}

/**
 * 下一个单词（从答案显示后）
 */
function nextWord() {
    if (!currentWord || sessionEnded) return;
    recordAnswer(false, true);
    practiceIndex++;
    loadNextWord();
}

/**
 * ==================== 主题切换 ==================== */

/**
 * 初始化主题
 */
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    }
    updateThemeIcon();
}

/**
 * 切换主题
 */
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon();
}

/**
 * 更新主题图标
 */
function updateThemeIcon() {
    const button = document.getElementById('theme-toggle');
    const container = document.getElementById('theme-icon-container');
    if (container) {
        const isDark = document.body.classList.contains('dark-mode');
        container.innerHTML = `<img src="assets/icons/${isDark ? 'sun' : 'moon'}.png" alt="theme" class="oil-icon" />`;
    }
    if (button) {
        const isDark = document.body.classList.contains('dark-mode');
        button.setAttribute('aria-label', isDark ? '切换到浅色模式' : '切换到深色模式');
    }
}

// 页面加载时初始化主题
// 已在 DOMContentLoaded 中统一处理
// document.addEventListener('DOMContentLoaded', () => {
//     initTheme();
// });
