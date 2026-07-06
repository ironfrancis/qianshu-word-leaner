/**
 * 每日目标 UI 集成模块
 * 通过 MutationObserver 监听 DOM 变化，零侵入现有代码。
 * - 首页注入「每日目标进度条」+「连续打卡天数」
 * - 练习完成时自动记录并更新
 * - 达成目标时播放庆祝动画
 */
(function () {
    'use strict';

    /* ==================== 首页仪表盘渲染 ==================== */

    var DASHBOARD_ID = 'daily-goal-dashboard';
    var recordedThisSession = false;

    function buildDashboardHTML(dash) {
        var today = dash.today;
        var streakLabel = dash.streak > 0
            ? '🔥 ' + dash.streak + ' 天连续打卡'
            : '🎯 开始你的第一天';

        var barColor = today.targetMet ? 'var(--accent-success)' : 'var(--accent-primary)';
        var statusText = today.targetMet
            ? '✅ 今日目标已完成！'
            : '今日已练 <strong>' + today.practiced + '</strong> / ' + today.target + ' 词';

        return ''
            + '<div class="dg-card">'
            +   '<div class="dg-streak-row">'
            +     '<span class="dg-streak">' + streakLabel + '</span>'
            +     '<span class="dg-best" title="历史最佳连续天数">🏆 ' + dash.bestStreak + '</span>'
            +   '</div>'
            +   '<div class="dg-bar-track">'
            +     '<div class="dg-bar-fill" style="width:' + today.percentage + '%; background:' + barColor + ';"></div>'
            +   '</div>'
            +   '<p class="dg-status">' + statusText + '</p>'
            + '</div>';
    }

    function renderDashboard() {
        var container = document.getElementById(DASHBOARD_ID);
        if (!container) return;
        if (typeof dailyGoalManager === 'undefined') return;

        var dash = dailyGoalManager.getDashboard();
        container.innerHTML = buildDashboardHTML(dash);
    }

    function ensureDashboardSlot() {
        var homeSection = document.getElementById('word-source-section');
        if (!homeSection) return;
        if (document.getElementById(DASHBOARD_ID)) return;

        // 插入到 home-intro 之后、pack-selector 之前
        var intro = homeSection.querySelector('.home-intro');
        var slot = document.createElement('div');
        slot.id = DASHBOARD_ID;
        slot.className = 'daily-goal-slot';
        slot.setAttribute('role', 'region');
        slot.setAttribute('aria-label', '每日目标');

        if (intro && intro.nextSibling) {
            homeSection.insertBefore(slot, intro.nextSibling);
        } else {
            homeSection.insertBefore(slot, homeSection.firstChild);
        }
    }

    /* ==================== 练习完成记录 ==================== */

    /**
     * 监听完成页可见性变化，自动记录本次练习
     */
    function watchCompleteSection() {
        var completeSection = document.getElementById('complete-section');
        if (!completeSection) return;

        var observer = new MutationObserver(function () {
            var isVisible = !completeSection.classList.contains('hidden');
            if (isVisible && !recordedThisSession) {
                recordSession();
            }
            if (!isVisible) {
                // 离开完成页时重置标记
                recordedThisSession = false;
            }
        });

        observer.observe(completeSection, { attributes: true, attributeFilter: ['class'] });
    }

    /**
     * 从完成页 DOM 读取本次练习统计并记录
     */
    function recordSession() {
        if (typeof dailyGoalManager === 'undefined') return;
        if (typeof sessionStats === 'undefined') return;

        var count = sessionStats.total || 0;
        if (count === 0) return;

        recordedThisSession = true;
        var result = dailyGoalManager.recordPractice(count);

        // 首次达标 → 播放庆祝动画
        if (result.newlyMet) {
            showGoalCelebration(result);
        }

        // 更新首页仪表盘（用户返回首页时看到最新数据）
        renderDashboard();
    }

    /* ==================== 达成目标庆祝 ==================== */

    var celebrationEl = null;
    var celebrationTimer = null;

    function showGoalCelebration(result) {
        ensureCelebrationEl();
        var el = celebrationEl;

        el.innerHTML = ''
            + '<div class="gc-emoji">🎉</div>'
            + '<div class="gc-title">今日目标达成！</div>'
            + '<div class="gc-detail">已练习 ' + result.practiced + ' 词</div>';

        el.classList.remove('show');
        void el.offsetWidth;
        el.classList.add('show');

        if (celebrationTimer) clearTimeout(celebrationTimer);
        celebrationTimer = setTimeout(function () {
            el.classList.remove('show');
        }, 2500);
    }

    function ensureCelebrationEl() {
        if (celebrationEl) return celebrationEl;
        celebrationEl = document.createElement('div');
        celebrationEl.className = 'goal-celebration';
        celebrationEl.setAttribute('aria-hidden', 'true');
        document.body.appendChild(celebrationEl);
        return celebrationEl;
    }

    /* ==================== 练习开始时刷新仪表盘 ==================== */

    /**
     * 监听首页可见性，回到首页时刷新数据
     */
    function watchHomeSection() {
        var homeSection = document.getElementById('word-source-section');
        if (!homeSection) return;

        var observer = new MutationObserver(function () {
            var isVisible = !homeSection.classList.contains('hidden');
            if (isVisible) {
                renderDashboard();
            }
        });

        observer.observe(homeSection, { attributes: true, attributeFilter: ['class'] });
    }

    /* ==================== 初始化 ==================== */

    function init() {
        ensureDashboardSlot();
        renderDashboard();
        watchCompleteSection();
        watchHomeSection();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
