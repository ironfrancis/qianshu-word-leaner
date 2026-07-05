const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createHowlMock() {
    const instances = [];

    class Howl {
        constructor(options) {
            this.src = options.src;
            this._volume = options.volume;
            this.playCount = 0;
            this.stopCount = 0;
            instances.push(this);
        }

        play() {
            this.playCount++;
            return 1;
        }

        stop() {
            this.stopCount++;
        }

        volume(value) {
            if (value !== undefined) {
                this._volume = value;
            }
            return this._volume;
        }
    }

    return { Howl, instances };
}

function loadSoundEffectsManager() {
    const { Howl, instances } = createHowlMock();
    const source = fs.readFileSync(path.join(__dirname, '../js/sound-effects.js'), 'utf8');
    const context = {
        Howl,
        Howler: { version: '2.2.4' },
        window: {},
        console
    };

    vm.createContext(context);
    const manager = vm.runInContext(`${source}\nsoundManager;`, context);

    return { manager, instances };
}

function testIsEnabledByDefault() {
    const { manager } = loadSoundEffectsManager();

    assert.strictEqual(manager.isEnabled(), true);
    assert.strictEqual(manager.getVolume(), 1);
}

function testToggleEnabledState() {
    const { manager } = loadSoundEffectsManager();

    assert.strictEqual(manager.isEnabled(), true);
    assert.strictEqual(manager.toggle(), false);
    assert.strictEqual(manager.isEnabled(), false);
    assert.strictEqual(manager.toggle(), true);
    assert.strictEqual(manager.isEnabled(), true);
}

function testSetVolumeClampsToZeroAndOne() {
    const { manager } = loadSoundEffectsManager();

    manager.setVolume(1.5);
    assert.strictEqual(manager.getVolume(), 1);

    manager.setVolume(-0.2);
    assert.strictEqual(manager.getVolume(), 0);
}

function testSetVolumeUpdatesAllSounds() {
    const { manager, instances } = loadSoundEffectsManager();

    manager.setVolume(0.4);

    assert.strictEqual(manager.getVolume(), 0.4);
    assert.strictEqual(instances.length, 3);
    instances.forEach(instance => {
        assert.strictEqual(instance.volume(), 0.4);
    });
}

function testPlayMethodsRespectDisabledState() {
    const { manager, instances } = loadSoundEffectsManager();

    manager.toggle();

    manager.playKeyPress();
    manager.playCorrect();
    manager.playIncorrect();

    instances.forEach(instance => {
        assert.strictEqual(instance.playCount, 0);
        assert.strictEqual(instance.stopCount, 0);
    });
}

function testPlayKeyPressWhenEnabled() {
    const { manager, instances } = loadSoundEffectsManager();
    const keySound = instances[0];

    manager.setVolume(0.7);
    manager.playKeyPress();

    assert.strictEqual(keySound.stopCount, 1);
    assert.strictEqual(keySound.playCount, 1);
    assert.strictEqual(keySound.volume(), 0.7);
}

function testPlayToggleUsesHalfVolumeWhenReEnabled() {
    const { manager, instances } = loadSoundEffectsManager();
    const correctSound = instances[1];

    manager.setVolume(0.8);
    manager.toggle();
    manager.toggle();

    assert.strictEqual(correctSound.playCount, 1);
    assert.strictEqual(correctSound.volume(), 0.4);
}

const tests = [
    testIsEnabledByDefault,
    testToggleEnabledState,
    testSetVolumeClampsToZeroAndOne,
    testSetVolumeUpdatesAllSounds,
    testPlayMethodsRespectDisabledState,
    testPlayKeyPressWhenEnabled,
    testPlayToggleUsesHalfVolumeWhenReEnabled
];

for (const test of tests) {
    test();
    console.log(`ok - ${test.name}`);
}
