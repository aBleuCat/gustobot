const syllableWords = {
    5: ['hippopotamus', 'refridgerator', 'sunnyside rail yard', 'me gusta tacos'],
    4: ['orbitalstone', 'garfungledee'],
    3: ['caleb lu', 'caleb paugh', 'stationdex', 'im hungry'],
    2: ['john kim'],
    1: ['yes', 'bruh', 'trust']
};

// Simple syllable counter
function countSyllables(text) {
    if (!text) return 0;
    text = text.toLowerCase().trim();
    
    // Remove punctuation for counting
    text = text.replace(/[^\w\s]/g, '');
    
    // Basic syllable count: vowel groups
    const vowels = text.match(/[aeiouy]+/g);
    let count = vowels ? vowels.length : 0;
    
    // Adjust for evil silent e
    if (text.endsWith('e')) count--;
    if (text.endsWith('le') && text.length > 2) count++;
    
    return Math.max(1, count);
}

// Find word(s) with specific syllable count
function getWordWithSyllables(targetSyllables) {
    const words = syllableWords[targetSyllables] || [];
    if (words.length === 0) return null;
    return words[Math.floor(Math.random() * words.length)];
}

// Get syllable count for a word
function getSyllableCount(word) {
    for (const [count, words] of Object.entries(syllableWords)) {
        if (words.includes(word.toLowerCase())) {
            return parseInt(count);
        }
    }
    return countSyllables(word);
}

// Analyze and fix haiku structure
function analyzeAndFixHaiku(text) {
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) return null;
    
    // Get syllable counts for each line
    const syllableCounts = lines.map(line => ({
        line: line.trim(),
        count: countSyllables(line)
    }));
    
    // Check if it's already a valid haiku (5-7-5)
    if (syllableCounts.length === 3 && 
        syllableCounts[0].count === 5 && 
        syllableCounts[1].count === 7 && 
        syllableCounts[2].count === 5) {
        return {
            isValid: true,
            content: lines.slice(0, 3).join('\n')
        };
    }
    
    // Ensure we have 3 lines
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
            // Add words to reach target
            let remaining = syllablesToAdd;
            while (remaining > 0) {
                // Try to find a word that fits perfectly, otherwise use 1-syllable fallback
                let word = getWordWithSyllables(remaining);
                
                if (!word) {
                    // If no exact match, find the largest word that fits
                    for (let i = remaining; i >= 1; i--) {
                        word = getWordWithSyllables(i);
                        if (word) {
                            remaining -= getSyllableCount(word);
                            break;
                        }
                    }
                    if (!word) break; // No valid words left
                } else {
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
            target: targets[i] 
        }))
    };
}

async function handleHaiku(msg) {
    if (!msg.content.includes('..haiku')) return;
    
    try {
        // Fetch recent messages
        const messages = await msg.channel.messages.fetch({ limit: 10 });
        const sortedMessages = Array.from(messages.values()).reverse();
        
        // Find the most recent message by this user (excluding the ..haiku command)
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
    } catch (e) {
        console.error("Haiku Error:", e.message);
    }
}

module.exports = { handleHaiku };
