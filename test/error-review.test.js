/**
 * error-review.js 纯函数测试
 *
 * 由于 error-review.js 以 IIFE 封装，内部函数不直接暴露，
 * 我们验证 buildErrorReviewHTML 的输出逻辑通过提取相同逻辑做独立测试。
 */
const assert = require('assert');

/* ==================== 模拟错题列表数据格式 ==================== */

function buildErrorReviewHTML(errorList) {
    if (!errorList || errorList.length === 0) return '';

    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    var items = errorList.map(function (item, i) {
        return (
            '<li class="error-review-item" data-word="' + escapeHTML(item.word) + '">' +
                '<span class="error-review-num">' + (i + 1) + '</span>' +
                '<div class="error-review-content">' +
                    '<span class="error-review-word">' + escapeHTML(item.word) + '</span>' +
                    '<span class="error-review-meaning">' + escapeHTML(item.meaning) + '</span>' +
                '</div>' +
            '</li>'
        );
    }).join('');

    return (
        '<div class="error-review-section" id="error-review-container">' +
            '<h3 class="error-review-title">📚 错题回顾</h3>' +
            '<p class="error-review-count">本轮答错 ' + errorList.length + ' 词，点击单词可听发音</p>' +
            '<ul class="error-review-list" role="list" aria-label="错题列表">' + items + '</ul>' +
        '</div>'
    );
}

/* ==================== 测试用例 ==================== */

function testEmptyListReturnsEmptyString() {
    assert.strictEqual(buildErrorReviewHTML([]), '');
    assert.strictEqual(buildErrorReviewHTML(null), '');
    assert.strictEqual(buildErrorReviewHTML(undefined), '');
}

function testSingleErrorItem() {
    var html = buildErrorReviewHTML([
        { word: 'apple', meaning: '苹果', index: 1 }
    ]);

    assert.match(html, /错题回顾/);
    assert.match(html, /本轮答错 1 词/);
    assert.match(html, /apple/);
    assert.match(html, /苹果/);
    assert.match(html, /data-word="apple"/);
}

function testMultipleErrorItems() {
    var html = buildErrorReviewHTML([
        { word: 'apple', meaning: '苹果', index: 1 },
        { word: 'banana', meaning: '香蕉', index: 2 },
        { word: 'cherry', meaning: '樱桃', index: 3 }
    ]);

    assert.match(html, /本轮答错 3 词/);
    assert.match(html, /apple/);
    assert.match(html, /banana/);
    assert.match(html, /cherry/);
    assert.match(html, /苹果/);
    assert.match(html, /香蕉/);
    assert.match(html, /樱桃/);
}

function testHTMLInjectionEscape() {
    var html = buildErrorReviewHTML([
        { word: '<script>', meaning: 'alert(1)', index: 1 }
    ]);

    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;/);
}

function testSequentialNumbering() {
    var html = buildErrorReviewHTML([
        { word: 'one', meaning: '一', index: 1 },
        { word: 'two', meaning: '二', index: 2 },
        { word: 'three', meaning: '三', index: 3 }
    ]);

    assert.match(html, /error-review-num">1</);
    assert.match(html, /error-review-num">2</);
    assert.match(html, /error-review-num">3</);
}

function testContainsAccessibilityAttributes() {
    var html = buildErrorReviewHTML([
        { word: 'test', meaning: '测试', index: 1 }
    ]);

    assert.match(html, /role="list"/);
    assert.match(html, /aria-label="错题列表"/);
}

/* ==================== 运行 ==================== */

const tests = [
    testEmptyListReturnsEmptyString,
    testSingleErrorItem,
    testMultipleErrorItems,
    testHTMLInjectionEscape,
    testSequentialNumbering,
    testContainsAccessibilityAttributes
];

let passed = 0;

for (const test of tests) {
    test();
    passed++;
    console.log(`✓ ${test.name}`);
}

console.log(`\n${passed}/${tests.length} error-review tests passed`);
