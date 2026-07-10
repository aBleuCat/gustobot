import type { Message } from "discord.js";
import queueMessage from "../helpers/message-queue.js";
import { randItem } from "../helpers/random-helpers.js";

type NonEmptyLines = [string, ...string[]];

function castAsNonEmptyLines(
	lines: string[],
): lines is NonEmptyLines {
	if (lines[0]) return true;
	return false;
}

const syllableWords: Record<number, string[]> = {
	5: [
		"hippopotamus",
		"refridgerator",
		"sunnyside rail yard",
		"me gusta tacos",
	],
	4: ["orbitalstone", "garfungledee"],
	3: ["caleb lu", "caleb paugh", "stationdex", "im hungry"],
	2: ["john kim"],
	1: ["yes", "bruh", "trust"],
};
const targets = [5, 7, 5];

// Simple syllable counter
function countSyllables(text: string) {
	if (!text) return 0;
	text = text.toLowerCase().trim();

	// Remove punctuation for counting
	text = text.replaceAll(/[^\w\s]/giv, "");

	// Basic syllable count: vowel groups
	const vowels = text.match(/[aeiouy]+/giv);
	let count = vowels ? vowels.length : 0;

	// Adjust for evil silent e
	if (text.endsWith("e")) count--;
	if (text.endsWith("le") && text.length > 2) count++;

	return Math.max(1, count);
}

// Find word(s) with specific syllable count
function getWordWithSyllables(targetSyllables: number) {
	const words = syllableWords[targetSyllables] ?? [];
	if (words.length === 0) return null;
	return randItem(words);
}

// Get syllable count for a word
function getSyllableCount(word: string) {
	for (const [count, words] of Object.entries(syllableWords)) {
		if (words.includes(word.toLowerCase())) {
			return Number.parseInt(count, 10);
		}
	}

	return countSyllables(word);
}

function breakUp(lines: NonEmptyLines) {
	const words = lines[0].split(/\s+/iv);
	const newLines = [];
	let wordIndex = 0;

	for (
		let lineNumber = 0;
		lineNumber < 3 && wordIndex < words.length;
		lineNumber++
	) {
		let currentLine = "";
		let currentSyllables = 0;
		const targetSyllables = targets[lineNumber] ?? 5; // Too lazy to do smth better

		while (
			wordIndex < words.length &&
			currentSyllables < targetSyllables
		) {
			const word: string = words[wordIndex]!;
			const wordSyllables = countSyllables(word);

			if (
				currentSyllables + wordSyllables <= targetSyllables ||
				currentLine === ""
			) {
				currentLine += (currentLine ? " " : "") + word;
				currentSyllables += wordSyllables;
				wordIndex++;
			} else {
				break;
			}
		}

		newLines.push(currentLine);
	}

	// Add remaining words to last line
	if (wordIndex < words.length) {
		newLines[2] += " " + words.slice(wordIndex).join(" ");
	}

	return newLines;
}

// Analyze and fix haiku structure
function analyzeAndFixHaiku(text: string) {
	let lines = text.split("\n").filter((line) => line.trim());

	if (lines.length === 0) return;
	if (!castAsNonEmptyLines(lines)) return;

	// If single line, try to break it into 3 lines intelligently
	if (lines.length === 1) {
		lines = breakUp(lines);
	}

	// Get syllable counts for each line
	const syllableCounts = lines.map((line) => ({
		line: line.trim(),
		count: countSyllables(line),
	}));

	// Check if it's already a valid haiku (5-7-5)
	if (
		syllableCounts.length === 3 &&
		syllableCounts[0]?.count === 5 &&
		syllableCounts[1]?.count === 7 &&
		syllableCounts[2]?.count === 5
	) {
		return {
			isValid: true,
			content: lines.slice(0, 3).join("\n"),
		};
	}

	// Ensure we have 3 lines
	while (syllableCounts.length < 3) {
		syllableCounts.push({ line: "", count: 0 });
	}

	syllableCounts.length = 3;
	const fixedLines = syllableCounts.map((lineData, index) => {
		const targetSyllables: number = targets[index]!;
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

				if (word) {
					remaining -= getSyllableCount(word);
				} else {
					// If no exact match, find the largest word that fits
					for (let i = remaining; i >= 1; i--) {
						word = getWordWithSyllables(i);
						if (word) {
							remaining -= getSyllableCount(word);
							break;
						}
					}

					if (!word) break; // No valid words left
				}

				if (word) {
					fixedLine += " " + word;
				}
			}
		}

		return fixedLine;
	});

	return {
		original: lines.slice(0, 3).join("\n"),
		fixed: fixedLines.join("\n"),
		counts: syllableCounts.map((l, i) => ({
			line: l.line,
			original: l.count,
			target: targets[i],
		})),
	};
}

async function handleHaiku(message: Message) {
	if (!message.content.includes("..haiku")) return;
	// Fetch recent messages
	const messages = await message.channel.messages.fetch({
		limit: 10,
	});
	const sortedMessages = [...messages.values()].toReversed();

	// Find the most recent message by this user (excluding the ..haiku command)
	let targetMessage = null;
	for (const m of sortedMessages) {
		if (
			m.author.id === message.author.id &&
			!m.content.includes("..haiku")
		) {
			targetMessage = m;
			break;
		}
	}

	if (!("send" in message.channel))
		throw new Error(`Expected sendable channel`);
	const { channel } = message;

	if (!targetMessage) {
		return queueMessage({
			channel,
			content:
				"I couldn't find a recent message of yours to check",
			reply: { message, mention: true },
		});
	}

	const result = analyzeAndFixHaiku(targetMessage.content);

	if (!result) {
		return queueMessage({
			channel,
			content:
				"I couldn't find a recent message of yours to check",
			reply: { message, mention: true },
		});
	}

	if (result.isValid) {
		return queueMessage({
			channel,
			content: result.content,
			reply: { message, mention: true },
		});
	}

	return queueMessage({
		channel: message.channel,
		content: result.fixed ?? "Haiku creation failed",
		reply: { message, mention: true },
	});
}

export default handleHaiku;
