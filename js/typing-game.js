/**
 * 打字游戏主逻辑
 */

// 初始化音效（在用户首次交互时）
document.addEventListener('DOMContentLoaded', () => {
    updateSoundIcon();
});

// 游戏状态
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

// 智能提示相关
let idleTimer = null;           // 检测用户是否停止输入
let hintTimer = null;           // 显示提示的定时器
let learningCardTimer = null;    // 30秒学习卡片定时器
let hintIndex = 0;               // 当前提示到第几个字母
let usedHints = false;           // 是否使用了提示
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
    idleTimer = null;
    hintTimer = null;
    learningCardTimer = null;
}

/**
 * 初始化练习
 */
function initPractice() {
    currentMode = 'learn';
    practiceQueue = [];
    practiceIndex = 0;
    sessionStats = { total: 0, correct: 0, incorrect: 0, streak: 0 };

    showSection('practice-section');
    switchMode('learn');
}

/**
 * 切换模式
 */
function switchMode(mode) {
    currentMode = mode;

    // 更新模式按钮状态
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.mode === mode) {
            btn.classList.add('active');
        }
    });

    // 获取该模式下的单词队列
    const wordList = getAvailableWords(mode);
    practiceQueue = wordList;
    practiceIndex = 0;

    // 更新徽章数量
    updateBadges();

    if (practiceQueue.length === 0) {
        if (mode === 'review') {
            showEmptyState('当前没有需要复习的单词 🎉');
        } else if (mode === 'mistake') {
            showEmptyState('太棒了！没有错题需要练习 🎉');
        } else {
            showEmptyState('没有可学习的单词');
        }
        return;
    }

    // 开始练习
    loadNextWord();
}

/**
 * 更新徽章数量
 */
function updateBadges() {
    const reviewList = getAvailableWords('review');
    const mistakeList = getAvailableWords('mistake');

    document.getElementById('review-count').textContent = reviewList.length;
    document.getElementById('mistake-count').textContent = mistakeList.length;
}

/**
 * 显示空状态
 */
function showEmptyState(message) {
    clearAllTimers();
    document.getElementById('chinese-word').textContent = message;
    document.getElementById('word-input').value = '';
    document.getElementById('word-input').disabled = true;
    updateStats();
}

/**
 * 加载下一个单词
 */
function loadNextWord() {
    if (practiceIndex >= practiceQueue.length) {
        showComplete();
        return;
    }

    // 清除之前的定时器
    clearAllTimers();

    // 重置提示状态
    hintIndex = 0;
    usedHints = false;
    lastInputLength = 0;
    lastInputTime = Date.now();
    isShowingHint = false;

    currentWord = practiceQueue[practiceIndex];
    const wordObj = getWordObject(currentWord);
    const wordRecord = memoryManager.getWord(currentWord);

    // 显示中文
    document.getElementById('chinese-word').textContent = wordObj.meaning;
    document.getElementById('word-input').value = '';
    document.getElementById('word-input').disabled = false;
    document.getElementById('word-input').classList.remove('correct', 'incorrect');
    document.getElementById('word-input').focus();
    document.getElementById('input-feedback').innerHTML = '';
    document.getElementById('answer-display').classList.add('hidden');

    // 检查是否是新单词（第一次学习）
    if (wordRecord && wordRecord.totalAttempts === 0) {
        // 新单词：先显示答案让用户学习
        setTimeout(() => {
            showLearningMode(currentWord);
        }, 300);
    }

    // 播放单词发音
    pronunciationManager.play(currentWord);

    // 启动提示定时器
    startHintSystem();

    updateStats();
}

/**
 * 启动智能提示系统
 */
function startHintSystem() {
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
 * 显示学习卡片（30秒卡住时）
 */
function showLearningCard(word) {
    clearAllTimers();

    const wordObj = getWordObject(word);
    const answerDisplay = document.getElementById('answer-display');

    answerDisplay.innerHTML = `
        <div class="learning-card permanent">
            <div class="learning-card-badge">💡 学习提示</div>
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
            <p class="learning-card-hint">这个单词需要多加练习哦</p>
            <button class="btn btn-primary" onclick="continueFromLearningCard()">我学会了，继续练习</button>
        </div>
    `;
    answerDisplay.classList.remove('hidden');

    // 记录为使用了提示
    usedHints = true;
}

/**
 * 从学习卡片继续
 */
function continueFromLearningCard() {
    // 记录为错误（因为用了提示）
    recordAnswer(false, true);
    practiceIndex++;
    loadNextWord();
}

/**
 * 显示学习模式（新单词先学习）
 */
function showLearningMode(word) {
    const wordObj = getWordObject(word);

    // 显示一个学习提示
    const answerDisplay = document.getElementById('answer-display');
    answerDisplay.innerHTML = `
        <div class="learning-mode">
            <div class="learning-badge">📖 新单词学习</div>
            <div class="word-pair">
                <span class="chinese">${wordObj.meaning}</span>
                <span class="arrow">→</span>
                <span class="english">${word}</span>
            </div>
            <p class="learning-hint">先记住这个单词，然后试着输入它</p>
        </div>
    `;
    answerDisplay.classList.remove('hidden');

    // 3秒后自动隐藏答案，让用户练习
    setTimeout(() => {
        if (currentWord === word && !document.getElementById('word-input').value) {
            answerDisplay.classList.add('hidden');
        }
    }, 3000);
}

/**
 * 更新输入反馈显示
 */
function updateInputFeedback() {
    const input = document.getElementById('word-input');
    const value = input.value.trim().toLowerCase();
    const feedback = document.getElementById('input-feedback');

    if (!currentWord) return;

    const target = currentWord.toLowerCase();

    // 实时显示输入反馈
    let feedbackHTML = '';
    for (let i = 0; i < Math.max(value.length, target.length); i++) {
        const char = value[i] || '';
        const targetChar = target[i] || '';

        if (char === '') {
            feedbackHTML += `<span class="char-empty">_</span>`;
        } else if (char === targetChar) {
            feedbackHTML += `<span class="char-correct">${char}</span>`;
        } else {
            feedbackHTML += `<span class="char-incorrect">${char}</span>`;
        }
    }
    feedback.innerHTML = feedbackHTML;
}

/**
 * 更新统计信息
 */
function updateStats() {
    const total = practiceQueue.length;
    const remaining = total - practiceIndex;
    const accuracy = sessionStats.total > 0
        ? Math.round((sessionStats.correct / sessionStats.total) * 100)
        : '-';

    document.getElementById('progress-text').textContent = `${practiceIndex}/${total}`;
    document.getElementById('accuracy-text').textContent = `${accuracy}%`;
    document.getElementById('streak-text').textContent = sessionStats.streak;

    // 更新进度条
    const progressPercent = (practiceIndex / total) * 100;
    document.getElementById('progress-fill').style.width = `${progressPercent}%`;
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

        // 清除原有的提示定时器，重新开始
        if (idleTimer) clearTimeout(idleTimer);
        if (hintTimer) clearTimeout(hintTimer);

        // 重新启动提示系统
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
        feedback.innerHTML = usedHints ? '✓ 正确！（使用了提示）' : '✓ 正确！';

        // 播放正确音效
        soundManager.playCorrect();

        // 记录结果
        recordAnswer(true, usedHints);

        // 短暂延迟后进入下一个
        setTimeout(() => {
            practiceIndex++;
            loadNextWord();
        }, 800);

    } else {
        // 还在输入中，保持正确状态
        input.classList.remove('correct', 'incorrect');
        document.getElementById('input-feedback').classList.remove('feedback-correct', 'feedback-incorrect');
    }
}

/**
 * 记录答题结果
 * @param {boolean} correct - 是否正确
 * @param {boolean} usedHint - 是否使用了提示
 */
function recordAnswer(correct, usedHint = false) {
    sessionStats.total++;
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

    updateBadges();
}

/**
 * 跳过当前单词（算作不会）
 */
function skipWord() {
    // 跳过算作不会，记录为错误
    recordAnswer(false);

    // 显示答案让用户学习一下
    showAnswer();

    // 用户查看后点击"下一个"才会继续
}

/**
 * 显示答案
 */
function showAnswer() {
    if (!currentWord) return;

    clearAllTimers();

    const answerDisplay = document.getElementById('answer-display');
    document.getElementById('correct-word').textContent = currentWord;
    answerDisplay.classList.remove('hidden');

    // 记录为错误
    const input = document.getElementById('word-input');
    if (!input.classList.contains('correct')) {
        recordAnswer(false);
    }
}

/**
 * 处理键盘事件
 */
function handleKeydown(event) {
    if (event.key === 'Enter') {
        if (document.getElementById('answer-display').classList.contains('hidden')) {
            showAnswer();
        } else {
            practiceIndex++;
            loadNextWord();
        }
    } else if (event.key === 'Tab') {
        event.preventDefault();
        skipWord();
    } else if (event.key === 'Escape') {
        backToSource();
    }
}

/**
 * 显示完成界面
 */
function showComplete() {
    clearAllTimers();
    showSection('complete-section');

    const accuracy = sessionStats.total > 0
        ? Math.round((sessionStats.correct / sessionStats.total) * 100)
        : 0;

    document.getElementById('complete-total').textContent = sessionStats.total;
    document.getElementById('complete-correct').textContent = sessionStats.correct;
    document.getElementById('complete-accuracy').textContent = `${accuracy}%`;

    // 根据正确率显示不同消息
    let message = '完成！';
    if (accuracy >= 90) {
        message = '太棒了！你的正确率很高！🎉';
    } else if (accuracy >= 70) {
        message = '不错！继续加油！💪';
    } else {
        message = '需要多加练习哦 📚';
    }
    document.getElementById('complete-text').textContent = message;
}

/**
 * 返回单词源选择
 */
function backToSource() {
    clearAllTimers();
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
.char-correct {
    color: #6B8E6B;
    font-weight: normal;
}
.char-incorrect {
    color: #B86B6B;
    font-weight: normal;
    text-decoration: line-through;
}
.char-empty {
    color: #D4CFC7;
}
.hint-mode {
    border-color: #8B7665 !important;
}
/* 学习卡片样式 */
.learning-card {
    text-align: center;
    animation: fadeIn 0.4s ease;
}
.learning-card.permanent {
    background: #F2EFE9;
    padding: 25px;
    margin: 20px 0;
}
.learning-card-badge {
    display: inline-block;
    color: #8B7665;
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
    color: #6B655F;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.chinese-large {
    font-size: 26px;
    font-weight: normal;
    color: #2C2724;
}
.english-large {
    font-size: 28px;
    font-weight: normal;
    color: #2C2724;
    font-family: 'SF Mono', 'Consolas', 'Monaco', 'Courier New', monospace;
    letter-spacing: 0.05em;
}
.arrow-large {
    color: #9A958F;
    font-size: 24px;
}
.learning-card-hint {
    color: #6B655F;
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
    const icon = document.getElementById('sound-icon');
    if (icon) {
        icon.textContent = soundManager.isEnabled() ? '🔊' : '🔇';
    }
}

/**
 * 切换发音开关
 */
function togglePronunciation() {
    pronunciationManager.toggle();
    updatePronunciationIcon();
}

/**
 * 更新发音图标
 */
function updatePronunciationIcon() {
    const icon = document.getElementById('pronunciation-icon');
    if (icon) {
        icon.textContent = pronunciationManager.isEnabled() ? '🔈' : '🔇';
    }
}

/**
 * 下一个单词（从答案显示后）
 */
function nextWord() {
    practiceIndex++;
    loadNextWord();
}
