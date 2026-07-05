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

function testPackMetricsExposeReadableLabels() {
    assert.match(
        html,
        /<div class="metric-cell" role="group" data-metric-label="待复习" aria-label="待复习 0 词">/,
        '待复习统计应把数字、含义和单位合并为可读标签'
    );
    assert.match(
        html,
        /<div class="metric-cell" role="group" data-metric-label="新词" aria-label="新词 0 词">/,
        '新词统计应把数字、含义和单位合并为可读标签'
    );
    assert.match(
        html,
        /<div class="metric-cell" role="group" data-metric-label="错题" aria-label="错题 0 词">/,
        '错题统计应把数字、含义和单位合并为可读标签'
    );
}

function testPackSelectorExposesKeyboardHelp() {
    assert.match(
        html,
        /<div class="pack-selector" role="tablist" aria-label="词包选择" aria-describedby="pack-selector-help">/,
        '词包选择器应关联键盘操作说明'
    );
    assert.match(
        html,
        /<p id="pack-selector-help" class="pack-help">使用 ←\/→ 方向键切换词包。<\/p>/,
        '首页应说明词包 tablist 的方向键操作方式'
    );
}

function testHomeWorkspaceExposesPackSummaryPanelLabel() {
    assert.match(
        html,
        /<article id="pack-panel" class="home-workspace" role="tabpanel" aria-label="小学英语全部，共 448 词">/,
        '首页词包工作区应暴露当前词包和总词数的面板标签'
    );
}

function testPackTabsControlWorkspacePanel() {
    assert.match(
        html,
        /<button id="pack-tab-primary" class="pack-tab active" data-pack="primary" role="tab" aria-selected="true" aria-controls="pack-panel" tabindex="0"/,
        '小学词包 tab 应通过 aria-controls 关联词包工作区'
    );
    assert.match(
        html,
        /<button id="pack-tab-computer" class="pack-tab" data-pack="computer" role="tab" aria-selected="false" aria-controls="pack-panel" tabindex="-1"/,
        '计算机词包 tab 应通过 aria-controls 关联词包工作区'
    );
    assert.match(
        html,
        /<article id="pack-panel" class="home-workspace" role="tabpanel" aria-label="小学英语全部，共 448 词">/,
        '首页词包工作区应作为 tabpanel 暴露给辅助技术'
    );
}

function run() {
    testSessionModeActionsHaveAccessibleGroup();
    testSessionModeActionsExposeKeyboardHelp();
    testPackMetricsExposeReadableLabels();
    testPackSelectorExposesKeyboardHelp();
    testHomeWorkspaceExposesPackSummaryPanelLabel();
    testPackTabsControlWorkspacePanel();
    console.log('home-a11y tests passed');
}

run();
