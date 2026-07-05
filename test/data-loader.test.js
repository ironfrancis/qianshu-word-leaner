const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '../js/data-loader.js'), 'utf8');

function loadDataLoaderFunctions(dictionaryEntries = []) {
    const context = {
        localStorage: { getItem: () => 'primary', setItem: () => {} },
        Map,
        Set,
        console,
        fetch: async () => ({ ok: false }),
        DOMParser: class {},
        alert: () => {},
        document: {
            querySelectorAll: () => [],
            getElementById: () => null
        },
        memoryManager: {
            getPackStats: () => ({ total: 0, dueReview: 0, new: 0, mistake: 0 }),
            filterWordsByMode: () => []
        },
        showSection: () => {}
    };

    const dictionarySetup = dictionaryEntries.length
        ? `wordDictionary = new Map(${JSON.stringify(dictionaryEntries)});`
        : '';

    vm.createContext(context);
    return vm.runInContext(`${source}\n${dictionarySetup}\n({ parseCSVLine, getMeaning, resolvePackTabNavigation, getPackTabRovingTabindex });`, context);
}

function testFetchPathsUseSiteRootDataDirectory() {
    assert.match(source, /fetch\(`data\/\$\{filename\}`\)/, 'XML 词库 fetch 应使用 data/ 前缀');
    assert.match(source, /fetch\('data\/trans_dict\.xml'\)/, '翻译字典 fetch 应使用 data/ 前缀');
    assert.doesNotMatch(source, /\.\.\/data\//, '不得使用 ../data/，否则 GitHub Pages 子路径下会 404');
}

function testWordPackConfigIsPresent() {
    assert.match(source, /const WORD_PACKS = \{/, '应保留词包配置');
    assert.match(source, /primary:/, '应保留小学词包');
    assert.match(source, /computer:/, '应保留计算机词包');
}

function assertArrayEqual(actual, expected, message) {
    assert.strictEqual(actual.length, expected.length, message);
    expected.forEach((value, index) => {
        assert.strictEqual(actual[index], value, message);
    });
}

function testParseCSVLineHandlesSimpleFields() {
    const { parseCSVLine } = loadDataLoaderFunctions();
    const fields = parseCSVLine('1,laptop,/ˈlæptɑːp/,笔记本电脑,Example,例句');

    assertArrayEqual(fields, ['1', 'laptop', '/ˈlæptɑːp/', '笔记本电脑', 'Example', '例句']);
}

function testParseCSVLineHandlesQuotedCommas() {
    const { parseCSVLine } = loadDataLoaderFunctions();
    const fields = parseCSVLine('64,block-based,/blɑːk beɪst/,积木式编程,"In block-based coding, you drag blocks together.",在积木式编程里，你拖动积木来组合。');

    assert.strictEqual(fields[4], 'In block-based coding, you drag blocks together.');
    assert.strictEqual(fields[5], '在积木式编程里，你拖动积木来组合。');
}

function testParseCSVLinePreservesEmptyTrailingField() {
    const { parseCSVLine } = loadDataLoaderFunctions();
    const fields = parseCSVLine('1,hello,,你好,,');

    assert.strictEqual(fields[2], '');
    assert.strictEqual(fields[5], '');
}

function testGetMeaningUsesExactMatchFirst() {
    const { getMeaning } = loadDataLoaderFunctions([
        ['Hello', '精确匹配'],
        ['hello', '小写匹配']
    ]);

    assert.strictEqual(getMeaning('Hello'), '精确匹配');
}

function testGetMeaningFallsBackToLowercase() {
    const { getMeaning } = loadDataLoaderFunctions([
        ['hello', '小写匹配']
    ]);

    assert.strictEqual(getMeaning('HELLO'), '小写匹配');
}

function testGetMeaningFallsBackToCapitalizedForm() {
    const { getMeaning } = loadDataLoaderFunctions([
        ['World', '首字母大写匹配']
    ]);

    assert.strictEqual(getMeaning('world'), '首字母大写匹配');
}

function testGetMeaningFallsBackToUppercaseForm() {
    const { getMeaning } = loadDataLoaderFunctions([
        ['TEST', '全大写匹配']
    ]);

    assert.strictEqual(getMeaning('test'), '全大写匹配');
}

function testGetMeaningReturnsFallbackWhenMissing() {
    const { getMeaning } = loadDataLoaderFunctions();

    assert.strictEqual(getMeaning('missing-word'), '未找到翻译');
}

function testResolvePackTabNavigationMovesRightWithWrap() {
    const { resolvePackTabNavigation } = loadDataLoaderFunctions();

    assert.strictEqual(
        resolvePackTabNavigation({ currentIndex: 0, tabCount: 2, key: 'ArrowRight' }),
        1
    );
    assert.strictEqual(
        resolvePackTabNavigation({ currentIndex: 1, tabCount: 2, key: 'ArrowRight' }),
        0
    );
}

function testResolvePackTabNavigationMovesLeftWithWrap() {
    const { resolvePackTabNavigation } = loadDataLoaderFunctions();

    assert.strictEqual(
        resolvePackTabNavigation({ currentIndex: 0, tabCount: 2, key: 'ArrowLeft' }),
        1
    );
}

function testResolvePackTabNavigationSupportsHomeAndEnd() {
    const { resolvePackTabNavigation } = loadDataLoaderFunctions();

    assert.strictEqual(
        resolvePackTabNavigation({ currentIndex: 1, tabCount: 2, key: 'Home' }),
        0
    );
    assert.strictEqual(
        resolvePackTabNavigation({ currentIndex: 0, tabCount: 2, key: 'End' }),
        1
    );
}

function testResolvePackTabNavigationIgnoresUnrelatedKeys() {
    const { resolvePackTabNavigation } = loadDataLoaderFunctions();

    assert.strictEqual(
        resolvePackTabNavigation({ currentIndex: 0, tabCount: 2, key: 'Enter' }),
        null
    );
}

function testGetPackTabRovingTabindexMarksActiveTab() {
    const { getPackTabRovingTabindex } = loadDataLoaderFunctions();

    assert.strictEqual(getPackTabRovingTabindex(1, 1), '0');
    assert.strictEqual(getPackTabRovingTabindex(1, 0), '-1');
}

const tests = [
    testFetchPathsUseSiteRootDataDirectory,
    testWordPackConfigIsPresent,
    testParseCSVLineHandlesSimpleFields,
    testParseCSVLineHandlesQuotedCommas,
    testParseCSVLinePreservesEmptyTrailingField,
    testGetMeaningUsesExactMatchFirst,
    testGetMeaningFallsBackToLowercase,
    testGetMeaningFallsBackToCapitalizedForm,
    testGetMeaningFallsBackToUppercaseForm,
    testGetMeaningReturnsFallbackWhenMissing,
    testResolvePackTabNavigationMovesRightWithWrap,
    testResolvePackTabNavigationMovesLeftWithWrap,
    testResolvePackTabNavigationSupportsHomeAndEnd,
    testResolvePackTabNavigationIgnoresUnrelatedKeys,
    testGetPackTabRovingTabindexMarksActiveTab
];

for (const test of tests) {
    test();
    console.log(`ok - ${test.name}`);
}
