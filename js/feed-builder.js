/**
 * Feed 构建模块
 * 按 12 复习 + 8 新词的目标比例生成一批练习单词。
 * 使用优先级加权抽样，并避免短期内重复练习同一批词。
 */

const SESSION_SIZE = 20;
const REVIEW_TARGET = 12;
const NEW_TARGET = 8;
const MISTAKE_REVIEW_CAP = 3;

function getErrorRate(word) {
    const record = memoryManager.getWord(word);
    return record.errorCount / (record.totalAttempts || 1);
}

function uniqueWords(words) {
    return [...new Set(words)];
}

function sampleWords(candidates, count, scoreFn) {
    if (count <= 0 || candidates.length === 0) {
        return [];
    }

    const pool = [...candidates];
    const result = [];

    while (result.length < count && pool.length > 0) {
        const weights = pool.map(word => Math.max(0.1, scoreFn(word)));
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        let roll = Math.random() * totalWeight;
        let pickedIndex = 0;

        for (let i = 0; i < pool.length; i++) {
            roll -= weights[i];
            if (roll <= 0) {
                pickedIndex = i;
                break;
            }
        }

        result.push(pool[pickedIndex]);
        pool.splice(pickedIndex, 1);
    }

    return result;
}

function pickReviewWords(wordList, count, seen = new Set()) {
    const dueWords = memoryManager.getDueReviewWords(wordList, seen);
    if (dueWords.length === 0) {
        return [];
    }

    const mistakeSet = new Set(memoryManager.getMistakeWords(wordList, seen));
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

function pickNewWords(wordList, count, seen = new Set(), selected = new Set()) {
    const newWords = memoryManager
        .getNewWords(wordList, seen)
        .filter(word => !selected.has(word));

    return sampleWords(newWords, count, word => memoryManager.getFeedPriority(word));
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

function buildSessionQueue(wordList, { limit = SESSION_SIZE, seen = new Set() } = {}) {
    const selected = new Set(seen);
    const reviewWords = pickReviewWords(wordList, REVIEW_TARGET, seen);

    reviewWords.forEach(word => selected.add(word));

    const newWords = pickNewWords(wordList, NEW_TARGET, seen, selected);
    newWords.forEach(word => selected.add(word));

    let queue = interleaveReviewAndNew(reviewWords, newWords, limit);

    if (queue.length >= limit) {
        return uniqueWords(queue).slice(0, limit);
    }

    const remainingCandidates = [
        ...memoryManager.getDueReviewWords(wordList, seen),
        ...memoryManager.getNewWords(wordList, seen)
    ].filter(word => !selected.has(word));

    const fillers = sampleWords(
        remainingCandidates,
        limit - queue.length,
        word => memoryManager.getFeedPriority(word)
    );

    queue = uniqueWords([...queue, ...fillers]).slice(0, limit);

    if (queue.length < limit) {
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
