/**
 * 单词发音管理器
 * 使用有道词典 API 提供英语单词发音
 */

class PronunciationManager {
    constructor() {
        this.enabled = true;
        this.pronunciationType = 'us'; // 'us' 美音, 'uk' 英音
        this.volume = 1.0;
        this.currentAudio = null;
    }

    /**
     * 生成发音 URL
     * @param {string} word - 单词
     * @param {string} type - 发音类型 'us' 美音, 'uk' 英音
     */
    generateUrl(word, type = 'us') {
        const api = 'https://dict.youdao.com/dictvoice?audio=';
        const typeParam = type === 'uk' ? '&type=1' : '&type=2';
        return `${api}${encodeURIComponent(word)}${typeParam}`;
    }

    /**
     * 播放单词发音
     * @param {string} word - 要播放的单词
     */
    play(word) {
        if (!this.enabled || !word) return;

        // 停止当前播放
        this.stop();

        const url = this.generateUrl(word, this.pronunciationType);
        this.currentAudio = new Audio(url);
        this.currentAudio.volume = this.volume;

        // 播放
        this.currentAudio.play().catch(err => {
            console.error('发音播放失败:', err);
        });
    }

    /**
     * 停止当前播放
     */
    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
    }

    /**
     * 切换发音类型（美音/英音）
     */
    toggleType() {
        this.pronunciationType = this.pronunciationType === 'us' ? 'uk' : 'us';
        return this.pronunciationType;
    }

    /**
     * 获取当前发音类型
     */
    getType() {
        return this.pronunciationType;
    }

    /**
     * 设置发音类型
     */
    setType(type) {
        if (type === 'us' || type === 'uk') {
            this.pronunciationType = type;
        }
    }

    /**
     * 切换发音开关
     */
    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    /**
     * 检查是否启用
     */
    isEnabled() {
        return this.enabled;
    }

    /**
     * 设置音量
     */
    setVolume(value) {
        this.volume = Math.max(0, Math.min(1, value));
        if (this.currentAudio) {
            this.currentAudio.volume = this.volume;
        }
    }

    /**
     * 获取音量
     */
    getVolume() {
        return this.volume;
    }

    /**
     * 预加载发音（可选优化）
     */
    prefetch(word) {
        if (!word) return;
        const url = this.generateUrl(word, this.pronunciationType);
        const audio = new Audio();
        audio.src = url;
        audio.preload = 'auto';
    }
}

// 创建全局发音管理器实例
const pronunciationManager = new PronunciationManager();

// 方便调试
window.pronunciationManager = pronunciationManager;
window.testPronunciation = (word = 'hello') => {
    pronunciationManager.play(word);
    console.log(`Playing pronunciation for: ${word} (${pronunciationManager.getType()})`);
};
