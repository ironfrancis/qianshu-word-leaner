/**
 * 数据加载模块
 * 负责从XML文件加载单词数据和翻译字典
 */

// 单词数据缓存
let wordDictionary = new Map(); // { word: meaning }
let currentWordList = []; // 当前选中的单词列表

/**
 * 解析单词XML文件
 */
async function parseWordXML(filename) {
    try {
        const response = await fetch(`data/${filename}`);
        if (!response.ok) {
            throw new Error(`加载文件失败: ${filename}`);
        }

        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

        // 检查解析错误
        const parseError = xmlDoc.querySelector('parsererror');
        if (parseError) {
            throw new Error('XML解析错误');
        }

        // 提取单词
        const items = xmlDoc.querySelectorAll('item');
        const words = [];

        items.forEach(item => {
            const word = item.getAttribute('comparision');
            if (word) {
                words.push(word);
            }
        });

        return words;
    } catch (error) {
        console.error('解析XML文件失败:', error);
        throw error;
    }
}

/**
 * 解析翻译字典XML
 */
async function parseTranslationDict() {
    try {
        const response = await fetch('data/trans_dict.xml');
        if (!response.ok) {
            throw new Error('加载翻译字典失败');
        }

        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

        // 检查解析错误
        const parseError = xmlDoc.querySelector('parsererror');
        if (parseError) {
            throw new Error('翻译字典XML解析错误');
        }

        // 提取翻译映射
        const pairs = xmlDoc.querySelectorAll('pair');
        const dict = new Map();

        pairs.forEach(pair => {
            const word = pair.getAttribute('word');
            const meaning = pair.getAttribute('explain');
            if (word && meaning) {
                dict.set(word, meaning);
            }
        });

        return dict;
    } catch (error) {
        console.error('解析翻译字典失败:', error);
        throw error;
    }
}

/**
 * 加载翻译字典（缓存）
 */
async function loadTranslationDict() {
    if (wordDictionary.size === 0) {
        wordDictionary = await parseTranslationDict();
        console.log(`翻译字典加载完成，共 ${wordDictionary.size} 个词条`);
    }
    return wordDictionary;
}

/**
 * 获取单词的中文释义
 */
function getMeaning(word) {
    // 精确匹配
    if (wordDictionary.has(word)) {
        return wordDictionary.get(word);
    }

    // 尝试小写匹配
    const lowerWord = word.toLowerCase();
    if (wordDictionary.has(lowerWord)) {
        return wordDictionary.get(lowerWord);
    }

    // 尝试首字母大写匹配
    const capitalized = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    if (wordDictionary.has(capitalized)) {
        return wordDictionary.get(capitalized);
    }

    // 尝试全大写匹配
    const upperWord = word.toUpperCase();
    if (wordDictionary.has(upperWord)) {
        return wordDictionary.get(upperWord);
    }

    return '未找到翻译';
}

/**
 * 加载全部单词
 */
async function loadAllWords() {
    const words9 = await parseWordXML('9.xml');
    const words10 = await parseWordXML('10.xml');
    const words11 = await parseWordXML('11.xml');
    return [...new Set([...words9, ...words10, ...words11])];
}

/**
 * 加载单词源
 */
async function loadWordSource(source) {
    showSection('loading-section');

    try {
        await loadTranslationDict();

        const wordList = source === 'all'
            ? await loadAllWords()
            : [...new Set(await parseWordXML(source))];

        currentWordList = wordList.map(word => ({
            word: word,
            meaning: getMeaning(word)
        }));

        console.log(`加载完成: ${currentWordList.length} 个单词`);
        updatePackOverview();
        showSection('word-source-section');
    } catch (error) {
        console.error('加载失败:', error);
        alert(`加载失败: ${error.message}\n请确保data文件夹中有相应的XML文件。`);
        showSection('word-source-section');
    }
}

/**
 * 加载默认词包（小学英语全部）
 */
async function loadDefaultWordPack() {
    await loadWordSource('all');
}

/**
 * 更新首页词包统计
 */
function updatePackOverview() {
    const wordList = currentWordList.map(item => item.word);
    const stats = memoryManager.getPackStats(wordList);

    const totalEl = document.getElementById('pack-total-count');
    const reviewEl = document.getElementById('pack-review-count');
    const newEl = document.getElementById('pack-new-count');
    const mistakeEl = document.getElementById('pack-mistake-count');

    if (totalEl) totalEl.textContent = stats.total;
    if (reviewEl) reviewEl.textContent = stats.dueReview;
    if (newEl) newEl.textContent = stats.new;
    if (mistakeEl) mistakeEl.textContent = stats.mistake;
}

/**
 * 获取当前单词列表
 */
function getCurrentWordList() {
    return currentWordList;
}

/**
 * 根据模式获取可用单词列表
 */
function getAvailableWords(mode) {
    const wordList = currentWordList.map(item => item.word);
    return memoryManager.filterWordsByMode(wordList, mode);
}

/**
 * 获取单词对象（包含翻译）
 */
function getWordObject(word) {
    return currentWordList.find(item => item.word === word) || { word, meaning: getMeaning(word) };
}
