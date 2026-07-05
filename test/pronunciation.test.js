const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadPronunciationManager() {
    const source = fs.readFileSync(path.join(__dirname, '../js/pronunciation.js'), 'utf8');
    const context = {
        Audio: class Audio {
            constructor() {
                this.volume = 1;
            }

            play() {
                return Promise.resolve();
            }

            pause() {}
        },
        window: {},
        console
    };

    vm.createContext(context);
    return vm.runInContext(`${source}\npronunciationManager;`, context);
}

function testGenerateUrlUsesUsTypeByDefault() {
    const manager = loadPronunciationManager();

    assert.strictEqual(
        manager.generateUrl('hello'),
        'https://dict.youdao.com/dictvoice?audio=hello&type=2'
    );
}

function testGenerateUrlUsesUkTypeWhenRequested() {
    const manager = loadPronunciationManager();

    assert.strictEqual(
        manager.generateUrl('hello', 'uk'),
        'https://dict.youdao.com/dictvoice?audio=hello&type=1'
    );
}

function testGenerateUrlEncodesSpecialCharacters() {
    const manager = loadPronunciationManager();

    assert.strictEqual(
        manager.generateUrl('a b&c'),
        'https://dict.youdao.com/dictvoice?audio=a%20b%26c&type=2'
    );
}

function testToggleTypeSwitchesBetweenUsAndUk() {
    const manager = loadPronunciationManager();

    assert.strictEqual(manager.getType(), 'us');
    assert.strictEqual(manager.toggleType(), 'uk');
    assert.strictEqual(manager.getType(), 'uk');
    assert.strictEqual(manager.toggleType(), 'us');
}

function testSetTypeIgnoresInvalidValues() {
    const manager = loadPronunciationManager();

    manager.setType('uk');
    assert.strictEqual(manager.getType(), 'uk');

    manager.setType('jp');
    assert.strictEqual(manager.getType(), 'uk');
}

function testSetVolumeClampsToZeroAndOne() {
    const manager = loadPronunciationManager();

    manager.setVolume(1.5);
    assert.strictEqual(manager.getVolume(), 1);

    manager.setVolume(-0.2);
    assert.strictEqual(manager.getVolume(), 0);
}

function testToggleEnabledState() {
    const manager = loadPronunciationManager();

    assert.strictEqual(manager.isEnabled(), true);
    assert.strictEqual(manager.toggle(), false);
    assert.strictEqual(manager.isEnabled(), false);
}

const tests = [
    testGenerateUrlUsesUsTypeByDefault,
    testGenerateUrlUsesUkTypeWhenRequested,
    testGenerateUrlEncodesSpecialCharacters,
    testToggleTypeSwitchesBetweenUsAndUk,
    testSetTypeIgnoresInvalidValues,
    testSetVolumeClampsToZeroAndOne,
    testToggleEnabledState
];

for (const test of tests) {
    test();
    console.log(`ok - ${test.name}`);
}
