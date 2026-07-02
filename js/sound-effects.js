/**
 * 音效管理器
 * 使用 Howler.js 和真实的音频文件
 */

class SoundEffectsManager {
    constructor() {
        this.enabled = true;
        this.volume = 1.0;

        // 按键音效 - 预加载以避免延迟
        this.keySound = new Howl({
            src: ['sounds/key.wav'],
            volume: this.volume,
            preload: true,
        });

        // 正确音效
        this.correctSound = new Howl({
            src: ['sounds/correct.wav'],
            volume: this.volume,
            preload: true,
        });

        // 错误音效
        this.incorrectSound = new Howl({
            src: ['sounds/beep.wav'],
            volume: this.volume,
            preload: true,
        });
    }

    /**
     * 初始化（Howler.js 不需要显式初始化）
     */
    init() {
        // Howler.js 在创建 Howl 对象时已自动初始化
    }

    /**
     * 播放按键音效
     */
    playKeyPress() {
        if (!this.enabled) return;

        // 停止之前的播放，避免重叠
        this.keySound.stop();
        this.keySound.volume(this.volume);
        this.keySound.play();
    }

    /**
     * 播放正确答案音效
     */
    playCorrect() {
        if (!this.enabled) return;

        this.correctSound.volume(this.volume);
        this.correctSound.play();
    }

    /**
     * 播放错误答案音效
     */
    playIncorrect() {
        if (!this.enabled) return;

        this.incorrectSound.volume(this.volume);
        this.incorrectSound.play();
    }

    /**
     * 播放开关音效
     */
    playToggle() {
        if (!this.enabled) return;

        this.correctSound.volume(this.volume * 0.5);
        this.correctSound.play();
    }

    /**
     * 切换音效开关
     */
    toggle() {
        this.enabled = !this.enabled;
        if (this.enabled) {
            this.playToggle();
        }
        return this.enabled;
    }

    /**
     * 设置音量
     */
    setVolume(value) {
        this.volume = Math.max(0, Math.min(1, value));
        // 更新所有音效的音量
        this.keySound.volume(this.volume);
        this.correctSound.volume(this.volume);
        this.incorrectSound.volume(this.volume);
    }

    /**
     * 获取音量
     */
    getVolume() {
        return this.volume;
    }

    /**
     * 检查是否启用
     */
    isEnabled() {
        return this.enabled;
    }

    /**
     * 调试：测试音效
     */
    test() {
        this.enabled = true;
        console.log('Sound test - Enabled:', this.enabled);
        console.log('Sound test - Volume:', this.volume);
        console.log('Howler.js version:', Howler.version);
        this.playCorrect();
    }
}

// 创建全局音效管理器实例
const soundManager = new SoundEffectsManager();

// 方便调试：在控制台输入 testSound() 即可测试音效
window.testSound = () => soundManager.test();
