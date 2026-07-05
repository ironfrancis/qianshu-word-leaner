const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const fixedNow = Date.UTC(2026, 6, 5, 12, 0, 0);

function defaultRecord(word) {
    return {
        word,
        stage: 0,
        lastReview: null,
        lastAttemptAt: null,
        correctCount: 0,
        errorCount: 0,
        totalAttempts: 0
    };
}

function createMemoryManager({ records = {}, recent = [], cursor = 0 } = {}) {
    return {
        records,
        cursor,
        getWord(word) {
            return this.records[word] || defaultRecord(word);
        },
        getNextReviewTime(word) {
            const record = this.getWord(word);
            return record.nextReviewTime ?? fixedNow;
        },
        needsReview(word) {
            const record = this.getWord(word);
            return record.totalAttempts > 0 && this.getNextReviewTime(word) <= fixedNow;
        },
        getNewWords(wordList, seen = new Set()) {
            return wordList.filter(word => !seen.has(word) && this.getWord(word).totalAttempts === 0);
        },
        getDueReviewWords(wordList, seen = new Set()) {
            return wordList
                .filter(word => !seen.has(word) && this.getWord(word).totalAttempts > 0 && this.needsReview(word))
                .sort((a, b) => this.getNextReviewTime(a) - this.getNextReviewTime(b));
        },
        getMistakeWords(wordList, seen = new Set()) {
            return wordList.filter(word => {
                const record = this.getWord(word);
                return !seen.has(word) && record.totalAttempts > 0 && record.errorCount > record.correctCount;
            });
        },
        getRecentPracticeWords() {
            return recent;
        },
        isRecentlyExcluded(word, excludeCount = 30) {
            const index = recent.indexOf(word);
            return index !== -1 && index < excludeCount;
        },
        getNewWordCursor() {
            return this.cursor;
        },
        advanceNewWordCursor(step) {
            this.cursor += step;
        }
    };
}

function loadFeedBuilder(memoryManager) {
    const source = fs.readFileSync(path.join(__dirname, '../js/feed-builder.js'), 'utf8');
    const context = {
        memoryManager,
        Date: { now: () => fixedNow },
        console
    };

    vm.createContext(context);
    vm.runInContext(source, context);
    return context;
}

function dueRecord(overrides = {}) {
    return {
        stage: 1,
        lastReview: fixedNow - 24 * 60 * 60 * 1000,
        lastAttemptAt: fixedNow - 24 * 60 * 60 * 1000,
        correctCount: 1,
        errorCount: 0,
        totalAttempts: 1,
        nextReviewTime: fixedNow - 60 * 60 * 1000,
        ...overrides
    };
}

function countPrefix(words, prefix) {
    return words.filter(word => word.startsWith(prefix)).length;
}

function testNewUserGetsSequentialNewWords() {
    const words = Array.from({ length: 25 }, (_, index) => `new-${index}`);
    const memoryManager = createMemoryManager();
    const { buildSessionQueue } = loadFeedBuilder(memoryManager);

    const queue = buildSessionQueue(words);

    assert.strictEqual(queue.length, 20);
    assert.deepStrictEqual(Array.from(queue), words.slice(0, 20));
    assert.strictEqual(memoryManager.cursor, 20);
}

function testHighReviewPressureReducesNewWords() {
    const dueWords = Array.from({ length: 18 }, (_, index) => `due-${index}`);
    const newWords = Array.from({ length: 12 }, (_, index) => `new-${index}`);
    const records = Object.fromEntries(dueWords.map(word => [word, dueRecord({
        stage: 0,
        correctCount: 0,
        errorCount: 3,
        totalAttempts: 3,
        nextReviewTime: fixedNow - 12 * 60 * 60 * 1000
    })]));
    const memoryManager = createMemoryManager({ records });
    const { buildSessionQueue } = loadFeedBuilder(memoryManager);

    const queue = buildSessionQueue([...dueWords, ...newWords]);

    assert.strictEqual(queue.length, 20);
    assert.strictEqual(countPrefix(queue, 'due-'), 14);
    assert.strictEqual(countPrefix(queue, 'new-'), 6);
}

function testLowReviewPressureAllowsMoreNewWords() {
    const dueWords = Array.from({ length: 5 }, (_, index) => `due-${index}`);
    const newWords = Array.from({ length: 20 }, (_, index) => `new-${index}`);
    const records = Object.fromEntries(dueWords.map(word => [word, dueRecord({
        stage: 7,
        correctCount: 10,
        errorCount: 0,
        totalAttempts: 10,
        nextReviewTime: fixedNow - 10 * 60 * 1000
    })]));
    const memoryManager = createMemoryManager({ records });
    const { buildSessionQueue } = loadFeedBuilder(memoryManager);

    const queue = buildSessionQueue([...dueWords, ...newWords]);

    assert.strictEqual(queue.length, 20);
    assert.strictEqual(countPrefix(queue, 'due-'), 5);
    assert.strictEqual(countPrefix(queue, 'new-'), 15);
}

function testMistakesArePrioritizedButCapped() {
    const mistakeWords = Array.from({ length: 12 }, (_, index) => `mistake-${index}`);
    const regularWords = Array.from({ length: 10 }, (_, index) => `regular-${index}`);
    const newWords = Array.from({ length: 10 }, (_, index) => `new-${index}`);
    const mistakeRecords = Object.fromEntries(mistakeWords.map(word => [word, dueRecord({
        stage: 0,
        correctCount: 0,
        errorCount: 4,
        totalAttempts: 4,
        nextReviewTime: fixedNow - 12 * 60 * 60 * 1000
    })]));
    const regularRecords = Object.fromEntries(regularWords.map(word => [word, dueRecord({
        stage: 3,
        correctCount: 5,
        errorCount: 1,
        totalAttempts: 6,
        nextReviewTime: fixedNow - 6 * 60 * 60 * 1000
    })]));
    const memoryManager = createMemoryManager({
        records: { ...mistakeRecords, ...regularRecords }
    });
    const { buildSessionQueue } = loadFeedBuilder(memoryManager);

    const queue = buildSessionQueue([...mistakeWords, ...regularWords, ...newWords]);

    assert.strictEqual(queue.length, 20);
    assert.strictEqual(countPrefix(queue, 'mistake-'), 6);
    assert.strictEqual(countPrefix(queue, 'regular-'), 8);
    assert.strictEqual(countPrefix(queue, 'new-'), 6);
}

function testRecentWordsStayExcludedWhenAlternativesExist() {
    const recentDueWords = Array.from({ length: 5 }, (_, index) => `recent-${index}`);
    const dueWords = Array.from({ length: 20 }, (_, index) => `due-${index}`);
    const records = Object.fromEntries([...recentDueWords, ...dueWords].map(word => [word, dueRecord({
        stage: 1,
        correctCount: 1,
        errorCount: 1,
        totalAttempts: 2,
        nextReviewTime: fixedNow - 3 * 60 * 60 * 1000
    })]));
    const memoryManager = createMemoryManager({
        records,
        recent: recentDueWords
    });
    const { buildSessionQueue } = loadFeedBuilder(memoryManager);

    const queue = buildSessionQueue([...recentDueWords, ...dueWords]);

    assert.strictEqual(queue.length, 20);
    assert.strictEqual(countPrefix(queue, 'recent-'), 0);
}

function testMasteredWordsOnlyFillWhenMainPoolIsShort() {
    const newWords = Array.from({ length: 5 }, (_, index) => `new-${index}`);
    const masteredWords = Array.from({ length: 20 }, (_, index) => `mastered-${index}`);
    const records = Object.fromEntries(masteredWords.map(word => [word, dueRecord({
        stage: 8,
        correctCount: 12,
        errorCount: 0,
        totalAttempts: 12,
        nextReviewTime: Infinity
    })]));
    const memoryManager = createMemoryManager({ records });
    const { buildSessionQueue } = loadFeedBuilder(memoryManager);

    const queue = buildSessionQueue([...newWords, ...masteredWords]);

    assert.strictEqual(queue.length, 20);
    assert.strictEqual(countPrefix(queue, 'new-'), 5);
    assert.strictEqual(countPrefix(queue, 'mastered-'), 15);
}

const tests = [
    testNewUserGetsSequentialNewWords,
    testHighReviewPressureReducesNewWords,
    testLowReviewPressureAllowsMoreNewWords,
    testMistakesArePrioritizedButCapped,
    testRecentWordsStayExcludedWhenAlternativesExist,
    testMasteredWordsOnlyFillWhenMainPoolIsShort
];

for (const test of tests) {
    test();
    console.log(`ok - ${test.name}`);
}
