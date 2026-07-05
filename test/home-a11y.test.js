const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

function testSessionModeActionsHaveAccessibleGroup() {
    assert.match(
        html,
        /<div class="home-actions" role="group" aria-labelledby="session-mode-heading" aria-describedby="session-mode-help">/,
        '首页练习模式按钮应使用带名称和说明的 group 语义'
    );
    assert.match(
        html,
        /<h3 id="session-mode-heading" class="sr-only">选择练习模式<\/h3>/,
        '练习模式按钮组应有屏幕阅读器可读标题'
    );
}

function testSessionModeActionsExposeKeyboardHelp() {
    assert.match(
        html,
        /<p id="session-mode-help" class="mode-help">使用 Tab 切换模式，按 Enter 或空格开始练习。<\/p>/,
        '首页应说明练习模式按钮的键盘操作方式'
    );
}

function run() {
    testSessionModeActionsHaveAccessibleGroup();
    testSessionModeActionsExposeKeyboardHelp();
    console.log('home-a11y tests passed');
}

run();
