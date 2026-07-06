/**
 * 练习体验增强模块
 * 键盘快捷键 · 连击庆祝动画 · 快捷键提示
 * 纯增量代码，不修改任何现有函数。
 */
(function () {
    'use strict';

    /* ==================== 键盘快捷键 ==================== */

    document.addEventListener('keydown', function (e) {
        var practiceVisible = !document.getElementById('practice-section').classList.contains('hidden');
        var completeVisible = !document.getElementById('complete-section').classList.contains('hidden');

        // Escape: 从练习区或完成页返回首页
        if (e.key === 'Escape' && (practiceVisible || completeVisible)) {
            e.preventDefault();
            backToSource();
            return;
        }

        // 输入框中不拦截其他键
        if (e.target && e.target.tagName === 'INPUT') return;

        // 完成页 Enter: 再来一轮
        if (e.key === 'Enter' && completeVisible) {
            e.preventDefault();
            repeatLastSession();
            return;
        }
    });

    /* ==================== 连击弹跳动画 ==================== */

    var streakEl = null;
    var lastStreak = 0;

    function initStreakObserver() {
        streakEl = document.getElementById('streak-text');
        if (!streakEl) return;

        lastStreak = parseInt(streakEl.textContent, 10) || 0;

        var observer = new MutationObserver(function () {
            var current = parseInt(streakEl.textContent, 10) || 0;
            if (current > lastStreak && current > 0) {
                // 连击增加 → 弹跳
                streakEl.classList.remove('streak-bump');
                void streakEl.offsetWidth; // 强制 reflow
                streakEl.classList.add('streak-bump');

                // 里程碑庆祝
                if (current >= 5 && current % 5 === 0) {
                    showMilestone(current);
                }
            }
            lastStreak = current;
        });

        observer.observe(streakEl, { childList: true, characterData: true, subtree: true });
    }

    /* ==================== 里程碑庆祝 ==================== */

    var milestoneEl = null;
    var milestoneTimer = null;

    var MILESTONE_LABELS = {
        5: '🔥 5 连击！',
        10: '⭐ 10 连击！太厉害了！',
        15: '🏆 15 连击！单词大师！',
        20: '👑 20 连击！无敌了！',
        25: '🌟 25 连击！传奇！',
        30: '🚀 30 连击！超神！'
    };

    function ensureMilestoneEl() {
        if (milestoneEl) return milestoneEl;
        milestoneEl = document.createElement('div');
        milestoneEl.className = 'milestone-badge';
        document.body.appendChild(milestoneEl);
        return milestoneEl;
    }

    function showMilestone(count) {
        var el = ensureMilestoneEl();
        var label = MILESTONE_LABELS[count] || ('🎉 ' + count + ' 连击！');
        el.textContent = label;

        el.classList.remove('show');
        void el.offsetWidth;
        el.classList.add('show');

        if (milestoneTimer) clearTimeout(milestoneTimer);
        milestoneTimer = setTimeout(function () {
            el.classList.remove('show');
        }, 1800);
    }

    /* ==================== 快捷键提示条 ==================== */

    function injectShortcutHints() {
        var practiceSection = document.getElementById('practice-section');
        if (!practiceSection || practiceSection.querySelector('.kb-hint-bar')) return;

        var hintBar = document.createElement('div');
        hintBar.className = 'kb-hint-bar';
        hintBar.setAttribute('aria-hidden', 'true');
        hintBar.innerHTML =
            '<span class="kb-hint-item"><kbd>Esc</kbd> 返回首页</span>' +
            '<span class="kb-hint-item"><kbd>Enter</kbd> 下一个</span>' +
            '<span class="kb-hint-item"><kbd>Tab</kbd> 切换按钮</span>';
        practiceSection.appendChild(hintBar);
    }

    /* ==================== 完成页快捷键提示 ==================== */

    function injectCompleteHints() {
        var completeSection = document.getElementById('complete-section');
        if (!completeSection || completeSection.querySelector('.kb-hint-bar')) return;

        var hintBar = document.createElement('div');
        hintBar.className = 'kb-hint-bar';
        hintBar.setAttribute('aria-hidden', 'true');
        hintBar.innerHTML =
            '<span class="kb-hint-item"><kbd>Enter</kbd> 再来一轮</span>' +
            '<span class="kb-hint-item"><kbd>Esc</kbd> 返回首页</span>';
        completeSection.appendChild(hintBar);
    }

    /* ==================== 初始化 ==================== */

    function init() {
        injectShortcutHints();
        injectCompleteHints();
        initStreakObserver();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
