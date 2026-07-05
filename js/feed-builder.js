/**
 * Feed 构建模块
 * 按动态比例生成练习队列，硬排除近期已练词，并按顺序推进新词。
 */

const SESSION_SIZE = 20;
const REVIEW_TARGET = 12;
const NEW_TARGET = 8;
const MISTAKE_REVIEW_CAP = 3;
const EXCLUDE_RELAX_STEPS = [30, 15, 0];

function getErrorRate(word) {
    const record = memoryManager.getWord(word);
    return record.errorCount / (record.totalAttempts || 1);
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

    const pool = [...candidates];
    const result = [];

    while (result.length < count && pool.length > 0) {
        const scored = pool
            .map(word => ({ word, weight: scoreFn(word) }))
            .filter(item => item.weight > 0);

        if (scored.length === 0) {
            break;
        }

        const totalWeight = scored.reduce((sum, item) => sum + item.weight, 0);
        let roll = Math.random() * totalWeight;
        let picked = scored[0].word;

        for (const item of scored) {
            roll -= item.weight;
            if (roll <= 0) {
                picked = item.word;
                break;
            }
        }

        result.push(picked);
        pool = pool.filter(word => word !== picked);
    }

    return result;
}

function getSessionTargets(wordList, seen, excludeCount) {
    const eligibleNew = filterCandidates(
        memoryManager.getNewWords(wordList, seen),
        seen,
        excludeCount
    ).length;
    const eligibleDue = filterCandidates(
        memoryManager.getDueReviewWords(wordList, seen),
        seen,
        excludeCount
    ).length;

    if (eligibleDue === 0) {
        return { review: 0, new: SESSION_SIZE };
    }

    if (eligibleNew >= NEW_TARGET + 4) {
        return { review: 6, new: 14 };
    }

    if (eligibleNew === 0) {
        return { review: SESSION_SIZE, new: 0 };
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
        MISTAKE_REVIEW_CAP,
        Math.ceil(count * 0.35)
    );

    const pickedMistakes = sampleWords(
        dueMistakes,
        mistakeQuota,
        word => memoryManager.getFeedPriority(word) + getErrorRate(word) * 10
    );
    const pickedSet = new Set(pickedMistakes);
    const pickedRegular = sampleWords(
        dueRegular.filter(word => !pickedSet.has(word)),
        count - pickedMistakes.length,
        word => memoryManager.getFeedPriority(word)
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
        word => memoryManager.getFeedPriority(word)
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
            word => memoryManager.getFeedPriority(word)
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
