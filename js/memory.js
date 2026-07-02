/**
 * 艾宾浩斯记忆曲线管理模块
 *
 * 复习间隔（基于艾宾浩斯遗忘曲线）:
 * 阶段0→1: 5分钟
 * 阶段1→2: 30分钟
 * 阶段2→3: 12小时
 * 阶段3→4: 1天
 * 阶段4→5: 2天
 * 阶段5→6: 4天
 * 阶段6→7: 7天
 * 阶段7→8: 15天
 * 阶段8+: 已掌握
 */

// 艾宾浩斯复习间隔（毫秒）
const REVIEW_INTERVALS = [
    5 * 60 * 1000,      // 5分钟
    30 * 60 * 1000,     // 30分钟
    12 * 60 * 60 * 1000, // 12小时
    24 * 60 * 60 * 1000, // 1天
    2 * 24 * 60 * 60 * 1000, // 2天
    4 * 24 * 60 * 60 * 1000, // 4天
    7 * 24 * 60 * 60 * 1000, // 7天
    15 * 24 * 60 * 60 * 1000 // 15天
];

const STORAGE_KEY = 'english_typing_progress';

/**
 * 记忆管理器类
 */
class MemoryManager {
    constructor() {
        this.data = this.loadData();
    }

    /**
     * 从localStorage加载学习数据
     */
    loadData() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.error('加载学习数据失败:', e);
        }
        return {};
    }

    /**
     * 保存学习数据到localStorage
     */
    saveData() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.error('保存学习数据失败:', e);
        }
    }

    /**
     * 获取单词的学习记录
     */
    getWord(word) {
        if (!this.data[word]) {
            return {
                word: word,
                meaning: null,
                stage: 0,
                lastReview: null,
                correctCount: 0,
                errorCount: 0,
                totalAttempts: 0
            };
        }
        return this.data[word];
    }

    /**
     * 更新或添加单词学习记录
     */
    updateWord(word, updates) {
        if (!this.data[word]) {
            this.data[word] = {
                word: word,
                meaning: updates.meaning || null,
                stage: 0,
                lastReview: null,
                correctCount: 0,
                errorCount: 0,
                totalAttempts: 0
            };
        }

        Object.assign(this.data[word], updates);
        this.saveData();
        return this.data[word];
    }

    /**
     * 记录答题结果
     * @param {string} word - 单词
     * @param {boolean} correct - 是否正确
     */
    recordResult(word, correct) {
        const record = this.getWord(word);
        const now = Date.now();

        record.totalAttempts++;

        if (correct) {
            record.correctCount++;
            record.lastReview = now;
            // 提升复习阶段
            if (record.stage < REVIEW_INTERVALS.length) {
                record.stage++;
            }
        } else {
            record.errorCount++;
            // 重置复习阶段
            record.stage = 0;
        }

        this.updateWord(word, record);
        return record;
    }

    /**
     * 记录带提示的答题结果
     * 带提示的正确答案不能算完全掌握，最多只能到阶段1（学习中）
     * @param {string} word - 单词
     * @param {boolean} correct - 是否正确
     */
    recordResultWithHint(word, correct) {
        const record = this.getWord(word);
        const now = Date.now();

        record.totalAttempts++;

        if (correct) {
            record.correctCount++;
            record.lastReview = now;
            // 带提示的正确最多只能到阶段1，保持在"学习中"状态
            // 如果当前是阶段0，可以提升到阶段1
            // 如果已经超过阶段1，保持不变（说明之前是无提示正确）
            if (record.stage === 0) {
                record.stage = 1;
            }
            // 如果已经在更高阶段，保持不变
        } else {
            record.errorCount++;
            // 错误时重置为阶段0
            record.stage = 0;
        }

        this.updateWord(word, record);
        return record;
    }

    /**
     * 计算单词下次复习时间
     */
    getNextReviewTime(word) {
        const record = this.getWord(word);

        if (record.stage === 0 || !record.lastReview) {
            // 新单词或未复习过，立即复习
            return Date.now();
        }

        if (record.stage > REVIEW_INTERVALS.length) {
            // 已掌握，不需要复习
            return Infinity;
        }

        const interval = REVIEW_INTERVALS[record.stage - 1];
        return record.lastReview + interval;
    }

    /**
     * 判断单词是否需要复习
     */
    needsReview(word) {
        const nextReview = this.getNextReviewTime(word);
        return nextReview <= Date.now();
    }

    /**
     * 获取单词状态
     */
    getWordStatus(word) {
        const record = this.getWord(word);

        if (record.totalAttempts === 0) {
            return 'new';
        } else if (record.errorCount > record.correctCount) {
            return 'mistake';
        } else if (record.stage >= REVIEW_INTERVALS.length) {
            return 'mastered';
        } else {
            return 'learning';
        }
    }

    /**
     * 获取统计信息
     */
    getStats(wordList) {
        let stats = {
            total: wordList.length,
            new: 0,
            learning: 0,
            mastered: 0,
            mistake: 0,
            needReview: 0,
            totalCorrect: 0,
            totalAttempts: 0
        };

        wordList.forEach(word => {
            const record = this.getWord(word);
            const status = this.getWordStatus(word);

            stats[status]++;
            stats.totalCorrect += record.correctCount || 0;
            stats.totalAttempts += record.totalAttempts || 0;

            if (this.needsReview(word)) {
                stats.needReview++;
            }
        });

        return stats;
    }

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

    /**
     * 根据模式筛选单词列表
     */
    filterWordsByMode(wordList, mode) {
        const now = Date.now();

        switch (mode) {
            case 'learn':
                // 学习模式：新词 + 需要复习的词
                return wordList.filter(word => {
                    const record = this.getWord(word);
                    return record.totalAttempts === 0 || this.needsReview(word);
                });

            case 'review':
                // 复习模式：需要复习的词（按复习时间排序）
                return wordList
                    .filter(word => this.needsReview(word) && this.getWord(word).totalAttempts > 0)
                    .sort((a, b) => this.getNextReviewTime(a) - this.getNextReviewTime(b));

            case 'mistake':
                // 错题模式：错误率高的词
                return wordList.filter(word => {
                    const record = this.getWord(word);
                    return record.totalAttempts > 0 && record.errorCount > record.correctCount;
                })
                .sort((a, b) => {
                    const recordA = this.getWord(a);
                    const recordB = this.getWord(b);
                    const errorRateA = recordA.errorCount / (recordA.totalAttempts || 1);
                    const errorRateB = recordB.errorCount / (recordB.totalAttempts || 1);
                    return errorRateB - errorRateA;
                });

            default:
                return wordList;
        }
    }

    /**
     * 重置所有数据（慎用）
     */
    resetAll() {
        if (confirm('确定要清除所有学习记录吗？此操作不可恢复！')) {
            this.data = {};
            this.saveData();
            return true;
        }
        return false;
    }

    /**
     * 重置单个单词的学习记录
     */
    resetWord(word) {
        if (this.data[word]) {
            delete this.data[word];
            this.saveData();
        }
    }

    /**
     * 导出学习数据
     */
    exportData() {
        return JSON.stringify(this.data, null, 2);
    }

    /**
     * 导入学习数据
     */
    importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            this.data = data;
            this.saveData();
            return true;
        } catch (e) {
            console.error('导入数据失败:', e);
            return false;
        }
    }
}

// 创建全局实例
const memoryManager = new MemoryManager();
