/**
 * Feed 构建模块
 * 按动态比例生成练习队列，硬排除近期已练词，并按顺序推进新词。
 */

const SESSION_SIZE = 20;
const REVIEW_TARGET = 12;
const NEW_TARGET = 8;
const HIGH_PRESSURE_REVIEW_TARGET = 14;
const LOW_PRESSURE_REVIEW_TARGET = 8;
const MISTAKE_REVIEW_RATIO = 0.4;
const EXCLUDE_RELAX_STEPS = [30, 15, 0];
const MASTERED_STAGE = 8;

function getErrorRate(word) {
    const record = memoryManager.getWord(word);
    return record.errorCount / (record.totalAttempts || 1);
}

function getAccuracy(word) {
    const record = memoryManager.getWord(word);
    return record.correctCount / (record.totalAttempts || 1);
}

function getRecentIndex(word) {
    const recentWords = memoryManager.getRecentPracticeWords
        ? memoryManager.getRecentPracticeWords()
        : [];
    return recentWords.indexOf(word);
}

function getRecencyPenalty(word) {
    const recentIndex = getRecentIndex(word);
    if (recentIndex === -1) {
        return 0;
    }

    return Math.max(6, 35 - recentIndex * 0.4);
}

function getReviewScore(word) {
    const record = memoryManager.getWord(word);
    if (record.totalAttempts === 0 || !memoryManager.needsReview(word)) {
        return 0;
    }

    const now = Date.now();
    const nextReview = memoryManager.getNextReviewTime(word);
    const overdueMinutes = Math.max(0, now - nextReview) / (60 * 1000);
    const overdueScore = Math.min(35, overdueMinutes / 30);
    const errorRate = getErrorRate(word);
    const accuracy = getAccuracy(word);
    const unstableStageScore = Math.max(0, MASTERED_STAGE - (record.stage || 0)) * 2;

    let score = 12 + overdueScore + unstableStageScore;
    score += errorRate * 30;
    score += Math.min(20, (record.errorCount || 0) * 3);

    if ((record.errorCount || 0) > (record.correctCount || 0)) {
        score += 12;
    }

    if ((record.stage || 0) >= MASTERED_STAGE && accuracy >= 0.85) {
        score *= 0.25;
    }

    score -= getRecencyPenalty(word);

    return Math.max(0.1, score);
}

function getNewWordScore(word) {
    return Math.max(0.1, 14 - getRecencyPenalty(word));
}

function getMasteredScore(word) {
    const record = memoryManager.getWord(word);
    const accuracy = getAccuracy(word);
    const lastAttemptAt = record.lastAttemptAt || record.lastReview || 0;
    const daysSincePractice = lastAttemptAt
        ? (Date.now() - lastAttemptAt) / (24 * 60 * 60 * 1000)
        : 0;

    return Math.max(0.1, 2 + Math.min(6, daysSincePractice / 7) - accuracy * 2 - getRecencyPenalty(word));
}

function uniqueWords(words) {
    return [...new Set(words)];
}

function filterCandidates(words, seen, excludeCount) {
    return words.filter(word => !seen.has(word) && !memoryManager.isRecentlyExcluded(word, excludeCount));
}

function sampleWords(candidates, count, scoreFn) {
    if (count <= 0 || candidates.length === 0) {
        return [];
    }

    return candidates
        .map((word, index) => ({ word, score: scoreFn(word), index }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .slice(0, count)
        .map(item => item.word);
}

function getSessionTargets(wordList, seen, excludeCount) {
    const eligibleNew = filterCandidates(
        memoryManager.getNewWords(wordList, seen),
        seen,
        excludeCount
    ).length;
    const dueWords = filterCandidates(
        memoryManager.getDueReviewWords(wordList, seen),
        seen,
        excludeCount
    );
    const eligibleDue = filterCandidates(
        dueWords,
        seen,
        excludeCount
    ).length;

    if (eligibleDue === 0) {
        return { review: 0, new: SESSION_SIZE };
    }

    if (eligibleNew === 0) {
        return { review: SESSION_SIZE, new: 0 };
    }

    const dueScores = dueWords.map(getReviewScore).sort((a, b) => b - a);
    const topScoreAverage = dueScores
        .slice(0, Math.min(REVIEW_TARGET, dueScores.length))
        .reduce((sum, score) => sum + score, 0) / Math.max(1, Math.min(REVIEW_TARGET, dueScores.length));
    const highPriorityDueCount = dueScores.filter(score => score >= 50).length;
    const mistakeDueCount = dueWords.filter(word => {
        const record = memoryManager.getWord(word);
        return (record.errorCount || 0) > (record.correctCount || 0);
    }).length;

    if (
        eligibleDue >= REVIEW_TARGET + 4 ||
        topScoreAverage >= 45 ||
        highPriorityDueCount >= 6 ||
        mistakeDueCount >= 6
    ) {
        return {
            review: HIGH_PRESSURE_REVIEW_TARGET,
            new: SESSION_SIZE - HIGH_PRESSURE_REVIEW_TARGET
        };
    }

    if (eligibleNew >= NEW_TARGET + 4 && eligibleDue <= LOW_PRESSURE_REVIEW_TARGET && topScoreAverage < 35) {
        return {
            review: LOW_PRESSURE_REVIEW_TARGET,
            new: SESSION_SIZE - LOW_PRESSURE_REVIEW_TARGET
        };
    }

    return { review: REVIEW_TARGET, new: NEW_TARGET };
}

function pickReviewWords(wordList, count, seen, excludeCount) {
    if (count <= 0) {
        return [];
    }

    const dueWords = filterCandidates(memoryManager.getDueReviewWords(wordList, seen), seen, excludeCount);
    if (dueWords.length === 0) {
        return [];
    }

    const mistakeSet = new Set(filterCandidates(memoryManager.getMistakeWords(wordList, seen), seen, excludeCount));
    const dueMistakes = dueWords.filter(word => mistakeSet.has(word));
    const dueRegular = dueWords.filter(word => !mistakeSet.has(word));

    const mistakeQuota = Math.min(
        count,
        dueMistakes.length,
        Math.ceil(count * MISTAKE_REVIEW_RATIO)
    );

    const pickedMistakes = sampleWords(
        dueMistakes,
        mistakeQuota,
        word => getReviewScore(word) + getErrorRate(word) * 10
    );
    const pickedSet = new Set(pickedMistakes);
    const pickedRegular = sampleWords(
        dueRegular.filter(word => !pickedSet.has(word)),
        count - pickedMistakes.length,
        word => getReviewScore(word)
    );

    return [...pickedMistakes, ...pickedRegular].slice(0, count);
}

function pickNewWords(wordList, count, seen, selected, excludeCount) {
    if (count <= 0) {
        return [];
    }

    const newWords = filterCandidates(memoryManager.getNewWords(wordList, seen), seen, excludeCount)
        .filter(word => !selected.has(word));

    if (newWords.length === 0) {
        return [];
    }

    const cursor = memoryManager.getNewWordCursor();
    const result = [];
    const used = new Set();

    for (let offset = 0; offset < newWords.length && result.length < count; offset++) {
        const word = newWords[(cursor + offset) % newWords.length];
        if (selected.has(word) || used.has(word)) continue;
        used.add(word);
        result.push(word);
    }

    if (result.length > 0) {
        memoryManager.advanceNewWordCursor(result.length);
    }

    return result;
}

function interleaveReviewAndNew(reviewWords, newWords, limit) {
    const reviewQueue = [...reviewWords];
    const newQueue = [...newWords];
    const result = [];

    while (result.length < limit && (reviewQueue.length > 0 || newQueue.length > 0)) {
        if (reviewQueue.length > 0) {
            result.push(reviewQueue.shift());
        }

        if (result.length >= limit) {
            break;
        }

        if (newQueue.length > 0) {
            result.push(newQueue.shift());
        }
    }

    return result.slice(0, limit);
}

function buildSessionQueueWithExclude(wordList, { limit = SESSION_SIZE, seen = new Set(), excludeCount = 30 } = {}) {
    const selected = new Set(seen);
    const { review: reviewTarget, new: newTarget } = getSessionTargets(wordList, seen, excludeCount);

    const reviewWords = pickReviewWords(wordList, reviewTarget, seen, excludeCount);
    reviewWords.forEach(word => selected.add(word));

    const newWords = pickNewWords(wordList, newTarget, seen, selected, excludeCount);
    newWords.forEach(word => selected.add(word));

    let queue = interleaveReviewAndNew(reviewWords, newWords, limit);

    if (queue.length >= limit) {
        return uniqueWords(queue).slice(0, limit);
    }

    const remainingCandidates = [
        ...filterCandidates(memoryManager.getDueReviewWords(wordList, seen), seen, excludeCount),
        ...filterCandidates(memoryManager.getNewWords(wordList, seen), seen, excludeCount)
    ].filter(word => !selected.has(word));

    const fillers = sampleWords(
        remainingCandidates,
        limit - queue.length,
        word => {
            const record = memoryManager.getWord(word);
            return record.totalAttempts === 0 ? getNewWordScore(word) : getReviewScore(word);
        }
    );

    queue = uniqueWords([...queue, ...fillers]).slice(0, limit);

    if (queue.length < limit && excludeCount === 0) {
        const masteredCandidates = wordList.filter(word => {
            if (selected.has(word)) return false;
            const record = memoryManager.getWord(word);
            return record.totalAttempts > 0 && !memoryManager.needsReview(word);
        });

        const masteredFillers = sampleWords(
            masteredCandidates,
            limit - queue.length,
            word => getMasteredScore(word)
        );

        queue = uniqueWords([...queue, ...masteredFillers]).slice(0, limit);
    }

    return queue;
}

function buildSessionQueue(wordList, options = {}) {
    for (const excludeCount of EXCLUDE_RELAX_STEPS) {
        const queue = buildSessionQueueWithExclude(wordList, { ...options, excludeCount });
        if (queue.length >= (options.limit || SESSION_SIZE) || excludeCount === 0) {
            return queue;
        }
    }

    return [];
}
