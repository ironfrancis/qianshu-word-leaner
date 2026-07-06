/**
 * 练习完成页错题回顾模块
 * 纯增量代码，不修改任何现有函数。
 *
 * 工作原理：
 * 1. Hook recordAnswer（全局函数）以拦截每次答题结果
 * 2. 当 sessionStats.incorrect > 0 且完成页可见时，渲染错题列表
 * 3. 列表在每次 startSession 时自动重置
 */
(function () {
    'use strict';

    /* ==================== 状态 ==================== */

    /** 收集本轮错题 [{ word, meaning, index }, ...] */
    var errorList = [];

    /** 当前练习序号计数 */
    var wordCounter = 0;

    /* ==================== Hook recordAnswer ==================== */

    var _originalRecordAnswer = null;

    function installRecordAnswerHook() {
        if (typeof window.recordAnswer !== 'function' || window.recordAnswer.__errorReviewHooked) return;

        _originalRecordAnswer = window.recordAnswer;
        window.recordAnswer = function (isCorrect, isRevealAnswer) {
            wordCounter++;

            if (!isCorrect) {
                // 收集错题信息
                var word = (typeof currentWord !== 'undefined') ? currentWord : null;
                if (word) {
                    var wordObj = (typeof getWordObject === 'function') ? getWordObject(word) : null;
                    errorList.push({
                        word: word,
                        meaning: wordObj ? wordObj.meaning : '',
                        index: wordCounter
                    });
                }
            }

            // 调用原始函数
            return _originalRecordAnswer.apply(this, arguments);
        };
        window.recordAnswer.__errorReviewHooked = true;
    }

    /* ==================== Hook startSession ==================== */

    var _originalStartSession = null;

    function installStartSessionHook() {
        if (typeof window.startSession !== 'function' || window.startSession.__errorReviewHooked) return;

        _originalStartSession = window.startSession;
        window.startSession = function () {
            // 重置错题收集
            errorList = [];
            wordCounter = 0;

            return _originalStartSession.apply(this, arguments);
        };
        window.startSession.__errorReviewHooked = true;
    }

    /* ==================== 渲染错题列表 ==================== */

    function buildErrorReviewHTML() {
        if (errorList.length === 0) return '';

        var items = errorList.map(function (item, i) {
            return (
                '<li class="error-review-item" data-word="' + escapeAttr(item.word) + '">' +
                    '<span class="error-review-num">' + (i + 1) + '</span>' +
                    '<div class="error-review-content">' +
                        '<span class="error-review-word">' + escapeHTML(item.word) + '</span>' +
                        '<span class="error-review-meaning">' + escapeHTML(item.meaning) + '</span>' +
                    '</div>' +
                '</li>'
            );
        }).join('');

        return (
            '<div class="error-review-section" id="error-review-container">' +
                '<h3 class="error-review-title">📚 错题回顾</h3>' +
                '<p class="error-review-count">本轮答错 ' + errorList.length + ' 词，点击单词可听发音</p>' +
                '<ul class="error-review-list" role="list" aria-label="错题列表">' + items + '</ul>' +
            '</div>'
        );
    }

    function renderErrorReview() {
        var completeSection = document.getElementById('complete-section');
        if (!completeSection) return;

        // 移除旧渲染
        var existing = document.getElementById('error-review-container');
        if (existing) existing.remove();

        if (errorList.length === 0) return;

        var html = buildErrorReviewHTML();
        var tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        var errorReviewEl = tempDiv.firstElementChild;
        if (!errorReviewEl) return;

        // 插入到 complete-actions 之前
        var actionsEl = completeSection.querySelector('.complete-actions');
        if (actionsEl) {
            actionsEl.parentNode.insertBefore(errorReviewEl, actionsEl);
        } else {
            completeSection.querySelector('.complete-message').appendChild(errorReviewEl);
        }

        // 绑定点击发音
        var items = errorReviewEl.querySelectorAll('.error-review-item');
        items.forEach(function (item) {
            item.addEventListener('click', function () {
                var word = item.getAttribute('data-word');
                if (word && typeof pronunciationManager !== 'undefined') {
                    pronunciationManager.play(word);
                }
            });
        });
    }

    /* ==================== 完成页可见性监听 ==================== */

    var hasRenderedForCurrentSession = false;

    function setupCompleteObserver() {
        var completeSection = document.getElementById('complete-section');
        if (!completeSection) return;

        var observer = new MutationObserver(function () {
            var isVisible = !completeSection.classList.contains('hidden');
            if (isVisible && !hasRenderedForCurrentSession) {
                hasRenderedForCurrentSession = true;
                // 延迟一帧确保 showComplete 已填充统计
                setTimeout(renderErrorReview, 50);
            }
            if (!isVisible) {
                hasRenderedForCurrentSession = false;
            }
        });

        observer.observe(completeSection, { attributes: true, attributeFilter: ['class'] });
    }

    /* ==================== 辅助函数 ==================== */

    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function escapeAttr(str) {
        return escapeHTML(str);
    }

    /* ==================== 初始化 ==================== */

    function init() {
        installRecordAnswerHook();
        installStartSessionHook();
        setupCompleteObserver();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
