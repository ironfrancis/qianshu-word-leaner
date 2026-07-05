const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '../js/data-loader.js'), 'utf8');

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

const tests = [
    testFetchPathsUseSiteRootDataDirectory,
    testWordPackConfigIsPresent
];

for (const test of tests) {
    test();
    console.log(`ok - ${test.name}`);
}
