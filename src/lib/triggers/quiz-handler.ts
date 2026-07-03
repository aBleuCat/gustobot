import { setTimeout as sleep } from "node:timers/promises";
import { EmbedBuilder, type Message } from "discord.js";
import { returnAsTextBased } from "../../type-utils.js";
import { quizzes, progressQuiz } from "../helpers/quiz-helpers.js";
import queueMessage from "../helpers/message-queue.js";
import devLog from "../helpers/dev-log.js";

async function handleQuiz(message: Message) {
	const channel = returnAsTextBased(message.channel);
	if (channel instanceof Error) return;
	const { author, content } = message;
	const channelId = channel.id;
	const quiz = quizzes.get(channelId);
	if (!quiz) return;

	if (
		quiz.currentQuestion.status === "closed" ||
		quiz.currentQuestion.status === "idle"
	) {
		return;
	}

	// Normalizes messages using the quiz's normalizers
	let normalizedMessage: string;
	if (typeof quiz.normalize === "function") {
		normalizedMessage = quiz.normalize(content);
	} else if (Array.isArray(quiz.normalize)) {
		normalizedMessage = content;
		// If there are multiple normalizers, run through each one
		for (const normalizer of quiz.normalize) {
			normalizedMessage = normalizer(normalizedMessage);
		}
	} else {
		normalizedMessage = content;
	}

	if (!quiz.currentQuestion.answer.test(normalizedMessage)) return;

	if (quiz.timer) {
		clearTimeout(quiz.timer);
		quiz.timer = undefined;
	}

	quiz.currentQuestion.status = "closed";

	let responseMessage = `The answer to "${quiz.currentQuestion.question}" was "${quiz.currentQuestion.answerTxt}"`;
	if (quiz.startTime) {
		const stopwatchTime = (Date.now() - quiz.startTime) / 1000;
		responseMessage += `\n${author.displayName} answered in ${stopwatchTime.toFixed(2)}s`;
	}

	if (quiz.rounds > 0 && quiz.remainingPool.length > 0) {
		const unixTimestamp = Math.floor(
			(Date.now() + quiz.delay * 1000) / 1000,
		);
		responseMessage += `\n\n-# Next question <t:${unixTimestamp}:R>`; // Put it in the description because the footer does not support timestamps
	} else {
		responseMessage += "\n\nThat was the last question.";
	}

	quiz.scores[author.id] = (quiz.scores[author.id] ?? 0) + 1;

	const leader =
		Object.entries(quiz.scores).toSorted(
			([, a], [, b]) => b - a,
		)[0]?.[0] ?? undefined;
	const leaderName = leader
		? (channel.guild?.members.cache.get(leader)?.displayName ??
			`User ${leader}`)
		: "Nobody";

	const embed = new EmbedBuilder()
		.setTitle(`Correct, ${author.displayName}!`)
		.setDescription(responseMessage)
		.setFooter({
			text: `${leaderName} is in the lead!`,
		})
		.setColor("#a6e3a1");

	await queueMessage({
		channel,
		embeds: [embed],
		priority: 3,
	});

	await sleep(quiz.delay * 1000);
	progressQuiz(channel).catch((error: unknown) => {
		console.log(error);
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		void devLog(errorMessage);
		void queueMessage({
			channel,
			content: `Error: ${errorMessage}`,
			priority: 4,
		});
	});
}

export default handleQuiz;
