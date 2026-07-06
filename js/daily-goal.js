/**
 * 每日目标与连续打卡追踪模块
 * 纯增量代码，通过 localStorage 持久化每日练习数据。
 * 不修改任何现有文件，仅提供全局对象 dailyGoalManager 供 typing-game.js 调用。
 */
(function (global) {
    'use strict';

    var STORAGE_KEY = 'qianshu_daily_goal_v1';
    var DEFAULT_TARGET = 50; // 每日默认目标词数

    /* ==================== 工具函数 ==================== */

    /**
     * 获取本地日期字符串 YYYY-MM-DD
     */
    function getTodayKey() {
        var d = new Date();
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + day;
    }

    /**
     * 在某日期上增减天数，返回 YYYY-MM-DD
     */
    function shiftDate(dateKey, delta) {
        var d = new Date(dateKey + 'T00:00:00');
        d.setDate(d.getDate() + delta);
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + day;
    }

    /* ==================== 数据读写 ==================== */

    function getData() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return createEmptyData();
            var parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return createEmptyData();
            if (!parsed.days) parsed.days = {};
            return parsed;
        } catch (e) {
            return createEmptyData();
        }
    }

    function saveData(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            // localStorage 不可用时静默降级
        }
    }

    function createEmptyData() {
        return {
            target: DEFAULT_TARGET,
            days: {}
        };
    }

    /* ==================== 核心 API ==================== */

    var dailyGoalManager = {
        STORAGE_KEY: STORAGE_KEY,

        /**
         * 获取当前每日目标
         */
        getTarget: function () {
            return getData().target || DEFAULT_TARGET;
        },

        /**
         * 设置每日目标
         */
        setTarget: function (count) {
            count = parseInt(count, 10) || DEFAULT_TARGET;
            if (count < 5) count = 5;
            if (count > 500) count = 500;
            var data = getData();
            data.target = count;
            saveData(data);
        },

        /**
         * 获取某天的数据，不存在则返回空
         */
        getDayData: function (dateKey) {
            var data = getData();
            return data.days[dateKey] || { practiced: 0, targetMet: false };
        },

        /**
         * 记录练习量，并检查是否达成目标
         * @param {number} count - 本次练习的单词数
         * @returns {object} { practiced, target, targetMet, newlyMet }
         */
        recordPractice: function (count) {
            count = parseInt(count, 10) || 0;
            var today = getTodayKey();
            var data = getData();
            var day = data.days[today] || { practiced: 0, targetMet: false };

            day.practiced += count;
            var newlyMet = false;
            if (!day.targetMet && day.practiced >= data.target) {
                day.targetMet = true;
                newlyMet = true;
            }

            data.days[today] = day;
            saveData(data);

            return {
                practiced: day.practiced,
                target: data.target,
                targetMet: day.targetMet,
                newlyMet: newlyMet
            };
        },

        /**
         * 获取今日进度
         */
        getTodayProgress: function () {
            var data = getData();
            var day = data.days[getTodayKey()] || { practiced: 0, targetMet: false };
            var pct = data.target > 0 ? Math.min(100, Math.round(day.practiced / data.target * 100)) : 0;
            return {
                practiced: day.practiced,
                target: data.target,
                percentage: pct,
                targetMet: day.targetMet
            };
        },

        /**
         * 计算连续打卡天数
         * 规则：从今天往前数，如果今天达标则今天算起；
         * 如果今天未达标则从昨天算起。
         */
        getStreak: function () {
            var data = getData();
            var today = getTodayKey();
            var todayDay = data.days[today];
            var streak = 0;

            // 决定起点
            if (todayDay && todayDay.targetMet) {
                streak = 1;
            } else {
                streak = 0;
            }

            // 从昨天（或前天）往前数
            var startKey = shiftDate(today, -1);
            while (true) {
                var d = data.days[startKey];
                if (d && d.targetMet) {
                    streak++;
                    startKey = shiftDate(startKey, -1);
                } else {
                    break;
                }
            }

            return streak;
        },

        /**
         * 获取总练习天数（有练习记录的天数）
         */
        getTotalActiveDays: function () {
            var data = getData();
            return Object.keys(data.days).filter(function (k) {
                return data.days[k].practiced > 0;
            }).length;
        },

        /**
         * 获取累计练习单词总数
         */
        getTotalPracticed: function () {
            var data = getData();
            return Object.keys(data.days).reduce(function (sum, k) {
                return sum + (data.days[k].practiced || 0);
            }, 0);
        },

        /**
         * 获取最佳连续天数（历史最高）
         */
        getBestStreak: function () {
            var data = getData();
            var keys = Object.keys(data.days).sort();
            var best = 0;
            var current = 0;
            var prevKey = null;

            for (var i = 0; i < keys.length; i++) {
                var k = keys[i];
                var d = data.days[k];
                if (d.targetMet) {
                    if (prevKey && shiftDate(prevKey, 1) === k) {
                        current++;
                    } else {
                        current = 1;
                    }
                    if (current > best) best = current;
                    prevKey = k;
                } else {
                    current = 0;
                    prevKey = null;
                }
            }

            return best;
        },

        /**
         * 获取用于 UI 渲染的全部数据
         */
        getDashboard: function () {
            var today = this.getTodayProgress();
            return {
                today: today,
                streak: this.getStreak(),
                bestStreak: this.getBestStreak(),
                totalDays: this.getTotalActiveDays(),
                totalPracticed: this.getTotalPracticed()
            };
        },

        /**
         * 清空所有数据（测试用）
         */
        _reset: function () {
            try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
        }
    };

    global.dailyGoalManager = dailyGoalManager;

})(typeof window !== 'undefined' ? window : globalThis);
