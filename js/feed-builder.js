/**
 * Feed 构建模块
 * 按 12 复习 + 8 新词的目标比例生成一批练习单词。
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

function takeAvailable(words, count, selected) {
    const result = [];

    for (const word of words) {
        if (result.length >= count) break;
        if (selected.has(word)) continue;

        selected.add(word);
        result.push(word);
    }

    return result;
}

function pickReviewWords(wordList, count, seen = new Set()) {
    const selected = new Set();
    const dueWords = memoryManager.getDueReviewWords(wordList, seen);
    const mistakeWords = memoryManager.getMistakeWords(wordList, seen);

    const dueMistakes = dueWords
        .filter(word => mistakeWords.includes(word))
        .sort((a, b) => getErrorRate(b) - getErrorRate(a));

    const dueRegular = dueWords.filter(word => !mistakeWords.includes(word));
    const overdueMistakes = takeAvailable(dueMistakes, count, selected);
    const regularReviews = takeAvailable(dueRegular, count - overdueMistakes.length, selected);

    const reviewWords = [...overdueMistakes, ...regularReviews];
    const remainingCount = count - reviewWords.length;

    if (remainingCount <= 0) {
        return reviewWords;
    }

    const notDueMistakes = mistakeWords
        .filter(word => !selected.has(word) && !dueWords.includes(word))
        .slice(0, Math.min(MISTAKE_REVIEW_CAP, remainingCount));

    return [...reviewWords, ...notDueMistakes];
}

function pickNewWords(wordList, count, seen = new Set(), selected = new Set()) {
    const newWords = memoryManager
        .getNewWords(wordList, seen)
        .filter(word => !selected.has(word));

    return newWords.slice(0, count);
}

function interleaveReviewAndNew(reviewWords, newWords, limit) {
    const result = [];
    const reviewQueue = [...reviewWords];
    const newQueue = [...newWords];

    while (result.length < limit && (reviewQueue.length > 0 || newQueue.length > 0)) {
        if (reviewQueue.length > 0) {
            result.push(reviewQueue.shift());
        }

        if (result.length >= limit) break;

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

    const queue = interleaveReviewAndNew(reviewWords, newWords, limit);

    if (queue.length >= limit) {
        return uniqueWords(queue).slice(0, limit);
    }

    const remainingCandidates = [
        ...memoryManager.getDueReviewWords(wordList, seen),
        ...memoryManager.getMistakeWords(wordList, seen),
        ...memoryManager.getNewWords(wordList, seen)
    ].filter(word => !selected.has(word));

    const fillers = takeAvailable(remainingCandidates, limit - queue.length, selected);
    return uniqueWords([...queue, ...fillers]).slice(0, limit);
}
