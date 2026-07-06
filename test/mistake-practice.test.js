/**
 * mistake-practice.js 纯函数测试
 *
 * 测试 deduplicateWords 的去重逻辑（保持顺序、去除重复）。
 * 该函数用于「专练本轮错题」时对从 DOM 读取的单词列表去重。
 */
const assert = require('assert');

/* ==================== 提取被测函数 ==================== */

// 直接 require 模块（module.exports 在 Node 环境下可用）
const { deduplicateWords } = require('../js/mistake-practice.js');

/* ==================== 测试用例 ==================== */

function testEmptyArray() {
    assert.deepStrictEqual(deduplicateWords([]), []);
}

function testNoDuplicates() {
    var input = ['apple', 'banana', 'cherry'];
    assert.deepStrictEqual(deduplicateWords(input), ['apple', 'banana', 'cherry']);
}

function testRemovesExactDuplicates() {
    var input = ['apple', 'banana', 'apple', 'cherry', 'banana'];
    assert.deepStrictEqual(deduplicateWords(input), ['apple', 'banana', 'cherry']);
}

function testPreservesOrder() {
    var input = ['zebra', 'apple', 'zebra', 'mango', 'apple'];
    var result = deduplicateWords(input);
    assert.deepStrictEqual(result, ['zebra', 'apple', 'mango']);
}

function testSingleElement() {
    assert.deepStrictEqual(deduplicateWords(['hello']), ['hello']);
}

function testAllDuplicates() {
    var input = ['test', 'test', 'test', 'test'];
    assert.deepStrictEqual(deduplicateWords(input), ['test']);
}

/* ==================== 运行 ==================== */

const tests = [
    testEmptyArray,
    testNoDuplicates,
    testRemovesExactDuplicates,
    testPreservesOrder,
    testSingleElement,
    testAllDuplicates
];

let passed = 0;

for (const test of tests) {
    test();
    passed++;
    console.log(`✓ ${test.name}`);
}

console.log(`\n${passed}/${tests.length} mistake-practice tests passed`);
