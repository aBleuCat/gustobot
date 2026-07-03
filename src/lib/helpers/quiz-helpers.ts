import { setTimeout as sleep } from "node:timers/promises";
import { EmbedBuilder, type GuildTextBasedChannel } from "discord.js";
import { config } from "../config.js";
import type {
	PoolQuestion,
	PreQuiz,
	ActiveQuiz,
} from "../../types.js";
import pools, { quizPoolImageLoader } from "../../data/quiz-pools.js";
import { randItem } from "./random-helpers.js";
import devLog from "./dev-log.js";
import queueMessage from "./message-queue.js";
import shuffle from "./shuffle-helper.js";
import dictToEmbed from "./embed-helpers.js";

/**
 * @param failedAction Should be a reduced adverbial clause, using -ing
 * @example handleError(error, channel, "progressing the quiz");
 */
const handleError = (
	error: unknown,
	channel: GuildTextBasedChannel,
	failedAction: string,
) => {
	console.error(error);
	const errorMessage =
		error instanceof Error
			? `Error when ${failedAction}: ${error.message}`
			: `Unknown error when ${failedAction}`;
	void devLog(errorMessage);
	void queueMessage({
		channel,
		content: errorMessage,
		priority: 4,
	});
};

const { QUIZ_START_DELAY } = config;

export const quizzes = new Map<string, ActiveQuiz>();

/** Waits for ansWindow time before expiring */
function activateAnsWindow(
	channel: GuildTextBasedChannel,
	ansWindow: number,
) {
	const quiz = quizzes.get(channel.id);
	if (!quiz)
		throw new Error(
			`No quiz found for ${channel.name} with id ${channel.id}`,
		);

	const { rounds } = quiz;
	if (typeof rounds !== "number") {
		throw new TypeError(
			`No numerical round value found for quiz ${channel.id} in channel ${channel.name}. The quiz likely does not exist`,
		);
	}

	if (quiz.timer) {
		clearTimeout(quiz.timer);
		quiz.timer = undefined;
	}

	quiz.timer = setTimeout(() => {
		expireAnsWindow(channel, rounds).catch((error: unknown) => {
			handleError(error, channel, "expiring the answer window");
		});
	}, ansWindow * 1000);
}

/**
 * Announces expiration, closes quiz, progresses quiz
 * @internal Should not be used outside of activateAnsWindow()
 */
export async function expireAnsWindow(
	channel: GuildTextBasedChannel,
	expectedRounds: number,
): Promise<void> {
	const quiz = quizzes.get(channel.id);
	if (!quiz)
		throw new Error(
			`No quiz found for ${channel.name} with id ${channel.id}`,
		);

	// Closed check is to prevent the expiration if someone guessed correctly a few seconds prior and the quiz hasnt progressed yet
	// rounds check is to prevent the expiration if the round already ended and another one started
	if (
		quiz.currentQuestion.status === "closed" ||
		expectedRounds !== quiz.rounds
	) {
		return;
	}

	quiz.currentQuestion.status = "closed";

	let description = `Nobody answered in ${quiz.ansWindow}s! The answer to "${quiz.currentQuestion.question}" was "${quiz.currentQuestion.answerTxt}"`;
	if (quiz.rounds > 0 && quiz.remainingPool.length > 0) {
		const unixTimestamp = Math.floor(
			(Date.now() + quiz.delay * 1000) / 1000,
		);
		description += `\n\nNext question <t:${unixTimestamp}:R>`;
	} else {
		description += "\n\nThat was the last question.";
	}

	const flavorTextOptions = [
		"You guys suck",
		"I've seen elderly type faster than you guys",
		"Hop off the game bro",
		"git gud",
		"My grandpa types faster than you and he's dead",
	];
	const embed = new EmbedBuilder()
		.setTitle("Nobody answered in time!")
		.setDescription(description)
		.setColor("#f38ba8")
		.setFooter({
			text: randItem(flavorTextOptions) ?? "git gud",
		});
	await queueMessage({
		channel,
		embeds: [embed],
		priority: 3,
	});

	await sleep(quiz.delay * 1000);
	progressQuiz(channel).catch((error: unknown) => {
		handleError(error, channel, "progressing the quiz");
	});
}

function endQuiz(channel: GuildTextBasedChannel) {
	const quiz = quizzes.get(channel.id);
	if (!quiz)
		throw new Error(
			`Error: No quiz ${channel.id} in channel ${channel.name} found`,
		);
	const scores = Object.fromEntries(
		Object.entries(quiz.scores).map(([name, score]) => [
			channel.guild?.members.cache.get(name)?.displayName ??
				`User ${name}`,
			score,
		]),
	);
	const embed: EmbedBuilder = dictToEmbed(
		"Scores",
		scores,
		"leaderboard",
		([, a], [, b]) => b - a,
	).setColor("#94e2d5");

	queueMessage({
		channel,
		content: `${quiz.title} has ended! Here are the results:`,
		embeds: [embed],
		priority: 3,
	}).catch((error: unknown) => {
		handleError(error, channel, "sending quiz results");
	});
	quizzes.delete(channel.id);
}

export async function progressQuiz(channel: GuildTextBasedChannel) {
	const quiz = quizzes.get(channel.id);
	if (!quiz)
		throw new Error(
			`Error: No quiz found in channel ${channel.name} with id ${channel.id}`,
		);

	if (quiz.timer) {
		clearTimeout(quiz.timer);
		quiz.timer = undefined;
	}

	if (quiz.rounds === 0) {
		try {
			endQuiz(channel);
		} catch (error) {
			handleError(error, channel, "ending the quiz");
		}

		return;
	}

	if (quiz.remainingPool.length === 0) {
		await queueMessage({
			channel,
			content: "There are no more questions remaining",
			priority: 3,
		});
		try {
			endQuiz(channel);
		} catch (error) {
			handleError(error, channel, "ending the quiz");
		}

		return;
	}

	let question: PoolQuestion | undefined;
	if (quiz.repeat === "all") {
		question = {
			...quiz.remainingPool[
				Math.floor(Math.random() * quiz.remainingPool.length)
			]!,
		};
	} else if (quiz.repeat === "questions") {
		question = quiz.remainingPool.pop();
		// Flatten images into different questions and pick one to display, shuffle the others across the deck for doing later
		if (
			Array.isArray(question?.image) &&
			question.image.length > 0
		) {
			const chosenImg: string =
				question.image[
					Math.floor(Math.random() * question.image.length)
				] ?? "Image failed to be found, somehow";
			for (const imageItem of question.image) {
				if (chosenImg === imageItem) {
					continue;
				}

				const { image: _, ...questionWithoutImages } =
					question;
				quiz.remainingPool.push({
					...questionWithoutImages,
					image: imageItem,
				});
			}

			// Disperse the new image questions
			quiz.remainingPool = shuffle(
				quiz.remainingPool,
				-(question.image.length - 1),
			);
			question.image = chosenImg;
		}
	} else {
		question = quiz.remainingPool.pop();
	}

	if (!question)
		throw new Error(
			`Error: question is undefined (Quiz id ${channel.id} in channel ${channel.name})`,
		);

	quiz.currentQuestion = { ...question, status: "open" };
	quiz.rounds--;
	const cQ = quiz.currentQuestion;
	const unixTimestamp = Math.floor(
		(Date.now() + quiz.ansWindow * 1000) / 1000,
	);
	const embed = new EmbedBuilder()
		.setTitle(
			`Question ${quiz.totalRounds - quiz.rounds} of ${quiz.totalRounds}`,
		)
		.setDescription(
			`${cQ.question}\n\nYou must answer <t:${unixTimestamp}:R>`,
		)
		.setColor("#fab387");

	if (typeof cQ.image === "string") {
		embed.setImage(cQ.image);
	} else if (cQ.image) {
		embed.setImage(
			cQ.image[Math.floor(Math.random() * cQ.image.length)]!,
		);
	}

	await queueMessage({
		channel,
		embeds: [embed],
		priority: 3,
	});

	quiz.startTime = Date.now();
	activateAnsWindow(channel, quiz.ansWindow);
}

export async function newQuiz(
	channel: GuildTextBasedChannel,
	quiz: PreQuiz,
	autoprogress?: boolean,
	force?: boolean,
) {
	if (!quizPoolImageLoader.done)
		return "Images have not been loaded yet, please try again later";
	if (quizzes.has(channel.id) && !(force === true))
		return `Error: A quiz is already active in channel ${channel.name} with id ${channel.id}`;

	let pool: PoolQuestion[] = [];
	const normalizers: Array<(value: string) => string> = [];

	if (typeof quiz.pool === "string") {
		const selectedPool = pools[quiz.pool];
		if (selectedPool) {
			pool = selectedPool.pool;
			const itemNormalizer = selectedPool.metadata?.normalizer;
			if (itemNormalizer) {
				normalizers.push(itemNormalizer);
			}
		} else {
			const error = `Error: No pool named ${quiz.pool} (Tried to create quiz ${channel.id} in channel ${channel.name})`;
			throw new Error(error);
		}
	} else {
		for (const item of quiz.pool) {
			if (pools[item]) {
				pool.push(...pools[item].pool);
				const itemNormalizer =
					pools[item]?.metadata?.normalizer;
				if (itemNormalizer) {
					normalizers.push(itemNormalizer);
				}
			} else {
				const error = `Error: No pool named ${item} (Tried to create quiz ${channel.id} in channel ${channel.name})`;
				throw new Error(error);
			}
		}
	}
	/* Deduplicate normalizer functions by comparing source code strings
	This prevents the same normalizers from running multiple times 
	when combining different question pools together.
	*/

	const seenCodes = new Set<string>();
	const uniqueNormalizers = normalizers.filter((fn) => {
		const code = fn.toString();
		if (seenCodes.has(code)) {
			return false;
		}

		seenCodes.add(code);
		return true;
	});

	const finalPool =
		quiz.repeat === "all" ? pool : shuffle(pool, quiz.rounds);
	const leQuiz: ActiveQuiz = {
		...quiz,
		totalRounds: quiz.rounds,
		remainingPool: finalPool,
		currentQuestion: {
			question: "",
			answer: / /v,
			answerTxt: "",
			status: "idle",
		},
		scores: {},
		normalize:
			uniqueNormalizers.length === 0
				? undefined
				: uniqueNormalizers.length === 1
					? uniqueNormalizers[0]
					: uniqueNormalizers,
	};
	quizzes.set(channel.id, leQuiz);
	const embed = new EmbedBuilder()
		.setTitle(quiz.title)
		.addFields(
			{
				name: `Pool${Array.isArray(quiz.pool) ? "s" : ""}`,
				value: Array.isArray(quiz.pool)
					? quiz.pool.join(", ")
					: quiz.pool,
			},
			{ name: "Rounds", value: quiz.rounds.toString() },
			{
				name: "Delay Between Questions",
				value: quiz.delay.toString() + " seconds",
			},
			{
				name: "Answer Window",
				value: quiz.ansWindow.toString() + " seconds",
			},
			{ name: "Repeat Type", value: quiz.repeat },
			{ name: "Prize*", value: quiz.prize ?? "None" },
		)
		.setFooter({ text: "*Prize handling does not exist yet" })
		.setColor("#89b4fa");
	await queueMessage({
		channel,
		content: `${quiz.title} is starting! woah`,
		embeds: [embed],
		priority: 3,
	});
	(async () => {
		await sleep(QUIZ_START_DELAY);
		if (autoprogress === false) return;
		const currentQuiz = quizzes.get(channel.id);
		if (!currentQuiz || currentQuiz !== leQuiz) {
			// The quiz was overwritten or deleted during the delay, exit quietly
			return;
		}

		progressQuiz(channel).catch((error: unknown) => {
			handleError(error, channel, "progressing the quiz");
		});
	})();

	return `A quiz was created successfully in channel ${channel.name} with id ${channel.id}`;
}
