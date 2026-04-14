const syllableWords = {
    5: ['hippopotamus', 'refridgerator', 'sunnyside rail yard', 'me gusta tacos'],
    4: ['orbitalstone', 'garfungledee'],
    3: ['caleb lu', 'caleb paugh', 'stationdex', 'im hungry'],
    2: ['john kim'],
    1: ['yes', 'bruh', 'trust'],
};
function countSyllables(text) {
    if (!text)
        return 0;
    text = text.toLowerCase().trim();
    text = text.replace(/[^\w\s]/g, '');
    const vowels = text.match(/[aeiouy]+/g);
    let count = vowels ? vowels.length : 0;
    if (text.endsWith('e'))
        count--;
    if (text.endsWith('le') && text.length > 2)
        count++;
    return Math.max(1, count);
}
function getWordWithSyllables(targetSyllables) {
    const words = syllableWords[targetSyllables] || [];
    if (words.length === 0)
        return null;
    return words[Math.floor(Math.random() * words.length)];
}
function getSyllableCount(word) {
    for (const [count, words] of Object.entries(syllableWords)) {
        if (words.includes(word.toLowerCase())) {
            return parseInt(count);
        }
    }
    return countSyllables(word);
}
function analyzeAndFixHaiku(text) {
    let lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0)
        return null;
    if (lines.length === 1) {
        const words = lines[0].split(/\s+/);
        const targets = [5, 7, 5];
        const newLines = [];
        let wordIndex = 0;
        for (let lineNum = 0; lineNum < 3 && wordIndex < words.length; lineNum++) {
            let currentLine = '';
            let currentSyllables = 0;
            const targetSyllables = targets[lineNum];
            while (wordIndex < words.length && currentSyllables < targetSyllables) {
                const word = words[wordIndex];
                const wordSyllables = countSyllables(word);
                if (currentSyllables + wordSyllables <= targetSyllables || currentLine === '') {
                    currentLine += (currentLine ? ' ' : '') + word;
                    currentSyllables += wordSyllables;
                    wordIndex++;
                }
                else {
                    break;
                }
            }
            newLines.push(currentLine);
        }
        if (wordIndex < words.length) {
            newLines[2] += ' ' + words.slice(wordIndex).join(' ');
        }
        lines = newLines;
    }
    const syllableCounts = lines.map(line => ({
        line: line.trim(),
        count: countSyllables(line),
    }));
    if (syllableCounts.length === 3 &&
        syllableCounts[0].count === 5 &&
        syllableCounts[1].count === 7 &&
        syllableCounts[2].count === 5) {
        return {
            isValid: true,
            content: lines.slice(0, 3).join('\n'),
        };
    }
    while (syllableCounts.length < 3) {
        syllableCounts.push({ line: '', count: 0 });
    }
    syllableCounts.length = 3;
    const targets = [5, 7, 5];
    const fixedLines = syllableCounts.map((lineData, index) => {
        const targetSyllables = targets[index];
        const currentSyllables = lineData.count;
        let fixedLine = lineData.line;
        if (currentSyllables === targetSyllables) {
            return fixedLine;
        }
        const syllablesToAdd = targetSyllables - currentSyllables;
        if (syllablesToAdd > 0) {
            let remaining = syllablesToAdd;
            while (remaining > 0) {
                let word = getWordWithSyllables(remaining);
                if (!word) {
                    for (let i = remaining; i >= 1; i--) {
                        word = getWordWithSyllables(i);
                        if (word) {
                            remaining -= getSyllableCount(word);
                            break;
                        }
                    }
                    if (!word)
                        break;
                }
                else {
                    remaining -= getSyllableCount(word);
                }
                if (word) {
                    fixedLine += ' ' + word;
                }
            }
        }
        return fixedLine;
    });
    return {
        original: lines.slice(0, 3).join('\n'),
        fixed: fixedLines.join('\n'),
        counts: syllableCounts.map((l, i) => ({
            line: l.line,
            original: l.count,
            target: targets[i],
        })),
    };
}
export async function handleHaiku(msg) {
    if (!msg.content.includes('..haiku'))
        return;
    try {
        const messages = await msg.channel.messages.fetch({ limit: 10 });
        const sortedMessages = Array.from(messages.values()).reverse();
        let targetMessage = null;
        for (const m of sortedMessages) {
            if (m.author.id === msg.author.id && !m.content.includes('..haiku')) {
                targetMessage = m;
                break;
            }
        }
        if (!targetMessage) {
            await msg.reply("I couldn't find a recent message of yours to check");
            return;
        }
        const result = analyzeAndFixHaiku(targetMessage.content);
        if (!result) {
            await msg.reply("I couldn't find a recent message of yours to check");
            return;
        }
        if (result.isValid) {
            await msg.reply(result.content);
            return;
        }
        await msg.reply(result.fixed);
    }
    catch (e) {
        console.error('Haiku Error:', e.message);
    }
}
//# sourceMappingURL=haiku.js.map