const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const fixedNow = Date.UTC(2026, 6, 5, 12, 0, 0);
const FIVE_MINUTES = 5 * 60 * 1000;

function createLocalStorage(initial = {}) {
    const store = { ...initial };

    return {
        getItem(key) {
            return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
        },
        setItem(key, value) {
            store[key] = String(value);
        },
        removeItem(key) {
            delete store[key];
        }
    };
}

function loadMemoryManager(localStorage, now = fixedNow) {
    const source = fs.readFileSync(path.join(__dirname, '../js/memory.js'), 'utf8');
    const context = {
        localStorage,
        Date: { now: () => now },
        console
    };

    vm.createContext(context);
    return vm.runInContext(`${source}\nmemoryManager;`, context);
}

function testCorrectAnswerAdvancesStage() {
    const memoryManager = loadMemoryManager(createLocalStorage());

    memoryManager.recordResult('apple', true);

    assert.strictEqual(memoryManager.getWord('apple').stage, 1);
    assert.strictEqual(memoryManager.getWord('apple').correctCount, 1);
}

function testWrongAnswerResetsStage() {
    const memoryManager = loadMemoryManager(createLocalStorage());

    memoryManager.recordResult('apple', true);
    memoryManager.recordResult('apple', true);
    memoryManager.recordResult('apple', false);

    assert.strictEqual(memoryManager.getWord('apple').stage, 0);
    assert.strictEqual(memoryManager.getWord('apple').errorCount, 1);
}

function testHintCorrectAnswerCapsAtStageOneFromZero() {
    const memoryManager = loadMemoryManager(createLocalStorage());

    memoryManager.recordResultWithHint('apple', true);

    assert.strictEqual(memoryManager.getWord('apple').stage, 1);
}

function testHintCorrectDoesNotReduceHigherStage() {
    const memoryManager = loadMemoryManager(createLocalStorage());

    memoryManager.recordResult('apple', true);
    memoryManager.recordResult('apple', true);
    memoryManager.recordResultWithHint('apple', true);

    assert.strictEqual(memoryManager.getWord('apple').stage, 2);
}

function testStageZeroReviewUsesCooldown() {
    const localStorage = createLocalStorage();
    const memoryManager = loadMemoryManager(localStorage);
    const afterCooldown = fixedNow + FIVE_MINUTES;

    memoryManager.recordResult('apple', false);

    assert.strictEqual(memoryManager.needsReview('apple'), false);
    assert.strictEqual(memoryManager.getNextReviewTime('apple'), afterCooldown);

    const readyManager = loadMemoryManager(localStorage, afterCooldown);
    assert.strictEqual(readyManager.needsReview('apple'), true);
}

function testMasteredWordStatusAndReviewTime() {
    const memoryManager = loadMemoryManager(createLocalStorage());

    for (let i = 0; i < 8; i += 1) {
        memoryManager.recordResult('apple', true);
    }

    const record = memoryManager.getWord('apple');
    assert.strictEqual(record.stage, 8);
    assert.strictEqual(memoryManager.getWordStatus('apple'), 'mastered');
    assert.strictEqual(
        memoryManager.getNextReviewTime('apple'),
        record.lastReview + 15 * 24 * 60 * 60 * 1000
    );
}

function testGetWordStatusClassification() {
    const memoryManager = loadMemoryManager(createLocalStorage());

    assert.strictEqual(memoryManager.getWordStatus('new-word'), 'new');

    memoryManager.recordResult('learning-word', true);
    assert.strictEqual(memoryManager.getWordStatus('learning-word'), 'learning');

    memoryManager.recordResult('mistake-word', false);
    memoryManager.recordResult('mistake-word', false);
    assert.strictEqual(memoryManager.getWordStatus('mistake-word'), 'mistake');
}

function testLegacyMigrationAddsLastAttemptAt() {
    const legacyData = {
        legacy: {
            word: 'legacy',
            stage: 2,
            lastReview: fixedNow - 60_000,
            correctCount: 2,
            errorCount: 0,
            totalAttempts: 2
        }
    };
    const localStorage = createLocalStorage({
        english_typing_progress: JSON.stringify(legacyData)
    });

    const memoryManager = loadMemoryManager(localStorage);
    const record = memoryManager.getWord('legacy');

    assert.ok(record.lastAttemptAt, '迁移后应补齐 lastAttemptAt');
    assert.strictEqual(record.lastAttemptAt, record.lastReview);
}

const tests = [
    testCorrectAnswerAdvancesStage,
    testWrongAnswerResetsStage,
    testHintCorrectAnswerCapsAtStageOneFromZero,
    testHintCorrectDoesNotReduceHigherStage,
    testStageZeroReviewUsesCooldown,
    testMasteredWordStatusAndReviewTime,
    testGetWordStatusClassification,
    testLegacyMigrationAddsLastAttemptAt
];

for (const test of tests) {
    test();
    console.log(`ok - ${test.name}`);
}
