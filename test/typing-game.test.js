const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createClassList() {
    const classes = new Set();
    return {
        add(...names) {
            names.forEach(name => classes.add(name));
        },
        remove(...names) {
            names.forEach(name => classes.delete(name));
        },
        toggle(name, force) {
            if (force === undefined) {
                if (classes.has(name)) classes.delete(name);
                else classes.add(name);
                return;
            }
            if (force) classes.add(name);
            else classes.delete(name);
        },
        contains(name) {
            return classes.has(name);
        }
    };
}

function createElementStub() {
    return {
        classList: createClassList(),
        textContent: '',
        innerHTML: '',
        value: '',
        disabled: false,
        style: {},
        focus() {},
        matches() {
            return false;
        },
        querySelector() {
            return null;
        },
        addEventListener() {},
        removeEventListener() {}
    };
}

function loadTypingGameHelpers() {
    const elements = new Map();
    const createdStyle = createElementStub();

    const documentStub = {
        addEventListener() {},
        querySelectorAll() {
            return [];
        },
        getElementById(id) {
            if (!elements.has(id)) {
                elements.set(id, createElementStub());
            }
            return elements.get(id);
        },
        createElement(tagName) {
            if (tagName === 'style') {
                return createdStyle;
            }
            return createElementStub();
        },
        head: {
            appendChild() {}
        },
        body: {
            classList: createClassList()
        }
    };

    const context = {
        document: documentStub,
        localStorage: {
            getItem() {
                return null;
            },
            setItem() {}
        },
        navigator: {
            vibrate() {}
        },
        lucide: {
            createIcons() {}
        },
        memoryManager: {
            recordRecentPractice() {},
            getWord() {
                return { totalAttempts: 0, errorCount: 0, correctCount: 0 };
            },
            recordResult() {},
            recordResultWithHint() {}
        },
        pronunciationManager: {
            play() {}
        },
        soundManager: {
            init() {},
            playKeyPress() {},
            playCorrect() {},
            playIncorrect() {},
            toggle() {
                return true;
            },
            isEnabled() {
                return true;
            }
        },
        getWordObject(word) {
            return { word, meaning: `含义-${word}` };
        },
        getCurrentWordList() {
            return [];
        },
        buildSessionQueue() {
            return [];
        },
        SESSION_SIZE: 20,
        updatePackOverview() {},
        setTimeout() {
            return 0;
        },
        clearTimeout() {},
        setInterval() {
            return 0;
        },
        clearInterval() {},
        console,
        window: {}
    };

    const source = fs.readFileSync(path.join(__dirname, '../js/typing-game.js'), 'utf8');
    vm.createContext(context);
    vm.runInContext(source, context);

    return {
        createEmptySessionStats: context.createEmptySessionStats,
        getSessionBatchCount: context.getSessionBatchCount,
        buildLearningCardHTML: context.buildLearningCardHTML
    };
}

function testCreateEmptySessionStatsShape() {
    const { createEmptySessionStats } = loadTypingGameHelpers();
    const stats = createEmptySessionStats();

    assert.strictEqual(stats.total, 0);
    assert.strictEqual(stats.correct, 0);
    assert.strictEqual(stats.incorrect, 0);
    assert.strictEqual(stats.streak, 0);
    assert.strictEqual(stats.newWords, 0);
    assert.strictEqual(stats.reviewWords, 0);
    assert.strictEqual(stats.mistakeWords, 0);
}

function testGetSessionBatchCountReturnsZeroWhenNoPractice() {
    const { getSessionBatchCount } = loadTypingGameHelpers();

    assert.strictEqual(
        getSessionBatchCount({ sessionStats: { total: 0 } }),
        0
    );
}

function testGetSessionBatchCountUsesPreviousBatchWhenQueueEmpty() {
    const { getSessionBatchCount } = loadTypingGameHelpers();

    assert.strictEqual(
        getSessionBatchCount({
            sessionStats: { total: 12 },
            practiceQueue: [],
            practiceIndex: 0,
            batchIndex: 4
        }),
        3
    );
}

function testGetSessionBatchCountReturnsCurrentBatchWhileActive() {
    const { getSessionBatchCount } = loadTypingGameHelpers();

    assert.strictEqual(
        getSessionBatchCount({
            sessionStats: { total: 5 },
            practiceQueue: ['apple', 'banana'],
            practiceIndex: 1,
            batchIndex: 2
        }),
        2
    );
}

function testBuildLearningCardHTMLIncludesWordPair() {
    const { buildLearningCardHTML } = loadTypingGameHelpers();

    const html = buildLearningCardHTML('apple', {
        badgeText: '新单词学习',
        hintText: '先记住这个单词'
    });

    assert.match(html, /apple/);
    assert.match(html, /含义-apple/);
    assert.match(html, /新单词学习/);
    assert.match(html, /先记住这个单词/);
    assert.doesNotMatch(html, /<button/);
}

function testBuildLearningCardHTMLIncludesContinueButtonWhenRequested() {
    const { buildLearningCardHTML } = loadTypingGameHelpers();

    const html = buildLearningCardHTML('apple', {
        badgeText: '学习提示',
        hintText: '需要多加练习',
        continueHandler: 'continueFromLearningCard()',
        continueLabel: '我学会了，继续练习'
    });

    assert.match(html, /continueFromLearningCard\(\)/);
    assert.match(html, /我学会了，继续练习/);
}

const tests = [
    testCreateEmptySessionStatsShape,
    testGetSessionBatchCountReturnsZeroWhenNoPractice,
    testGetSessionBatchCountUsesPreviousBatchWhenQueueEmpty,
    testGetSessionBatchCountReturnsCurrentBatchWhileActive,
    testBuildLearningCardHTMLIncludesWordPair,
    testBuildLearningCardHTMLIncludesContinueButtonWhenRequested
];

let passed = 0;

for (const test of tests) {
    test();
    passed++;
    console.log(`✓ ${test.name}`);
}

console.log(`\n${passed}/${tests.length} typing-game tests passed`);
