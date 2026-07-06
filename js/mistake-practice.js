/**
 * 错题专练模块
 * 纯增量代码，不修改任何现有文件。
 *
 * 功能：
 * 1. 首页「错题」计数动态更新
 * 2. 首页动态添加「错题专练」按钮（当有错题时显示）
 * 3. 完成页错题列表下方添加「专练这些错题」按钮
 * 4. 通过 Hook loadSessionBatch 实现自定义错题队列
 *
 * 工作原理：
 * - startMistakePractice() 收集当前词包的所有错题，设置 pendingMistakeQueue
 * - practiceSessionErrors() 从完成页 DOM 读取本轮错题，设置 pendingMistakeQueue
 * - Hook loadSessionBatch：当 pendingMistakeQueue 非空时，从中取词填充 practiceQueue
 * - 使用 challenge 模式启动，支持分批（每批 SESSION_SIZE 词）
 */
(function () {
    'use strict';

    /* ==================== 状态 ==================== */

    /** 待练习的错题队列（会被 loadSessionBatch 消费） */
    var pendingMistakeQueue = null;

    /* ==================== 纯函数（供测试） ==================== */

    /**
     * 对单词列表去重（保持顺序）
     */
    function deduplicateWords(words) {
        var seen = {};
        var result = [];
        for (var i = 0; i < words.length; i++) {
            if (!seen[words[i]]) {
                seen[words[i]] = true;
                result.push(words[i]);
            }
        }
        return result;
    }
    // 暴露纯函数供 Node 测试
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { deduplicateWords: deduplicateWords };
    }

    /* ==================== Hook loadSessionBatch ==================== */

    var _originalLoadSessionBatch = null;

    function installLoadSessionBatchHook() {
        if (typeof window.loadSessionBatch !== 'function' || window.loadSessionBatch.__mistakePracticeHooked) return;

        _originalLoadSessionBatch = window.loadSessionBatch;
        window.loadSessionBatch = function () {
            // 错题专练模式：从预置队列取词
            if (pendingMistakeQueue !== null) {
                var size = (typeof SESSION_SIZE !== 'undefined') ? SESSION_SIZE : 20;
                var batch = pendingMistakeQueue.splice(0, size);

                if (batch.length === 0) {
                    // 队列耗尽，结束
                    pendingMistakeQueue = null;
                    showComplete({ poolExhausted: sessionStats.total > 0 });
                    return;
                }

                practiceQueue = batch;
                practiceIndex = 0;
                currentBatchSize = practiceQueue.length;

                practiceQueue.forEach(function (word) {
                    sessionSeen.add(word);
                });

                loadNextWord();
                return;
            }

            return _originalLoadSessionBatch.apply(this, arguments);
        };
        window.loadSessionBatch.__mistakePracticeHooked = true;
    }

    /* ==================== Hook startSession ==================== */

    var _originalStartSession = null;

    function installStartSessionHook() {
        if (typeof window.startSession !== 'function' || window.startSession.__mistakePracticeHooked) return;

        _originalStartSession = window.startSession;
        window.startSession = function (type) {
            // 非 challenge 类型或队列已空时清除错题模式
            if (type !== 'challenge' || pendingMistakeQueue === null || pendingMistakeQueue.length === 0) {
                if (pendingMistakeQueue !== null && pendingMistakeQueue.length === 0) {
                    pendingMistakeQueue = null;
                }
            }
            return _originalStartSession.apply(this, arguments);
        };
        window.startSession.__mistakePracticeHooked = true;
    }

    /* ==================== 公共 API ==================== */

    /**
     * 收集当前词包的所有错题词（errorCount > correctCount）
     * @returns {string[]} 错题单词列表
     */
    function collectMistakeWords() {
        if (typeof getCurrentWordList !== 'function' || typeof memoryManager === 'undefined') return [];
        var wordList = getCurrentWordList().map(function (item) { return item.word; });
        var mistakes = memoryManager.getMistakeWords(wordList, new Set());
        return mistakes;
    }

    /**
     * 从完成页 DOM 读取本轮错题词
     * @returns {string[]} 错题单词列表
     */
    function getSessionErrorWordsFromDOM() {
        var items = document.querySelectorAll('.error-review-item[data-word]');
        var words = [];
        items.forEach(function (item) {
            var w = item.getAttribute('data-word');
            if (w) words.push(w);
        });
        return words;
    }

    /**
     * 启动错题专练（首页按钮 → 全部错题）
     */
    window.startMistakePractice = function () {
        var mistakes = collectMistakeWords();
        if (mistakes.length === 0) return;

        pendingMistakeQueue = mistakes;
        startSession('challenge');
    };

    /**
     * 专练本轮错题（完成页按钮 → 本轮错题）
     */
    window.practiceSessionErrors = function () {
        var errorWords = getSessionErrorWordsFromDOM();
        if (errorWords.length === 0) return;

        pendingMistakeQueue = deduplicateWords(errorWords);
        startSession('challenge');
    };

    /* ==================== 首页动态 UI ==================== */

    /**
     * 更新首页错题计数 + 错题专练按钮
     */
    function updateHomeMistakeUI() {
        var homeSection = document.getElementById('word-source-section');
        if (!homeSection || homeSection.classList.contains('hidden')) return;

        var mistakes = collectMistakeWords();
        var mistakeCount = mistakes.length;

        // 更新错题计数
        var mistakeMetric = document.getElementById('pack-mistake-count');
        if (mistakeMetric) {
            mistakeMetric.textContent = mistakeCount;
            var metricCell = mistakeMetric.closest('.metric-cell');
            if (metricCell) {
                metricCell.setAttribute('aria-label', '错题 ' + mistakeCount + ' 词');
            }
        }

        // 更新错题专练按钮
        var existingBtn = document.getElementById('mistake-practice-btn');

        if (mistakeCount === 0) {
            if (existingBtn) existingBtn.remove();
            return;
        }

        if (existingBtn) {
            var desc = existingBtn.querySelector('.btn-desc');
            if (desc) desc.textContent = mistakeCount + ' 词待攻克';
            return;
        }

        // 创建按钮
        var actionsEl = homeSection.querySelector('.home-actions');
        if (!actionsEl) return;

        var btn = document.createElement('button');
        btn.id = 'mistake-practice-btn';
        btn.className = 'btn btn-warning session-btn mistake-practice-btn';
        btn.setAttribute('onclick', 'startMistakePractice()');
        btn.innerHTML =
            '<span class="btn-label">🔥 错题专练</span>' +
            '<span class="btn-desc">' + mistakeCount + ' 词待攻克</span>';
        actionsEl.appendChild(btn);
    }

    /* ==================== 完成页动态按钮 ==================== */

    /**
     * 在错题列表下方添加「专练这些错题」按钮
     */
    function addCompletionMistakeButton() {
        var errorContainer = document.getElementById('error-review-container');
        if (!errorContainer) return;

        // 移除旧按钮
        var existing = document.getElementById('practice-errors-btn');
        if (existing) existing.remove();

        var errorWords = getSessionErrorWordsFromDOM();
        if (errorWords.length === 0) return;

        var btn = document.createElement('button');
        btn.id = 'practice-errors-btn';
        btn.className = 'btn btn-primary practice-errors-btn';
        btn.setAttribute('onclick', 'practiceSessionErrors()');
        btn.innerHTML =
            '<span class="btn-label">🎯 专练这些错题</span>' +
            '<span class="btn-desc">' + errorWords.length + ' 词</span>';

        errorContainer.appendChild(btn);
    }

    /* ==================== 观察器 ==================== */

    /**
     * 监听完成页错题列表出现
     */
    function setupCompleteObserver() {
        var completeSection = document.getElementById('complete-section');
        if (!completeSection) return;

        var observer = new MutationObserver(function () {
            var errorContainer = document.getElementById('error-review-container');
            if (errorContainer) {
                // 延迟以避免与 error-review.js 渲染冲突
                setTimeout(addCompletionMistakeButton, 200);
            }
        });

        observer.observe(completeSection, { childList: true, subtree: true });
    }

    /**
     * 监听首页可见性变化
     */
    function setupHomeObserver() {
        var homeSection = document.getElementById('word-source-section');
        if (!homeSection) return;

        var observer = new MutationObserver(function () {
            var isVisible = !homeSection.classList.contains('hidden');
            if (isVisible) {
                updateHomeMistakeUI();
            }
        });

        observer.observe(homeSection, { attributes: true, attributeFilter: ['class'] });
    }

    /* ==================== 初始化 ==================== */

    function init() {
        installLoadSessionBatchHook();
        installStartSessionHook();
        setupCompleteObserver();
        setupHomeObserver();
        // 首次更新
        setTimeout(updateHomeMistakeUI, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
