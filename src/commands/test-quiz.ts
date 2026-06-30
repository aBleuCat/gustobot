import {
	type ChatInputCommandInteraction,
	MessageFlags,
	SlashCommandBuilder,
} from "discord.js";
import type { PreQuiz } from "../types.js";
import pools from "../data/quiz-pools.js";
import { newQuiz } from "../lib/helpers/quiz-helpers.js";
import { returnAsTextBased } from "../type-utils.js";

const poolOptions = Object.keys(pools).map((name) => {
	return { name, value: name };
});
poolOptions.push({ name: "All pools", value: "all" });

function isRepeatType(
	repeat: string,
): repeat is "all" | "questions" | "none" {
	const repeatTypes = new Set(["all", "questions", "none"]);
	if (repeatTypes.has(repeat)) return true;
	return false;
}

const testQuizCommand = {
	data: new SlashCommandBuilder()
		.setName("testquiz")
		.setDescription("Beta - Test new quiz feature")
		.addStringOption((option) =>
			option
				.setName("title")
				.setDescription("Title of the quiz")
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("pool")
				.setDescription("Which pool to select questions from")
				.setChoices(poolOptions)
				.setRequired(true),
		)
		.addNumberOption((option) =>
			option
				.setName("rounds")
				.setDescription(
					"The number of rounds the quiz should last",
				)
				.setRequired(true),
		)
		.addNumberOption((option) =>
			option
				.setName("answer-window")
				.setDescription(
					"The amount of time available to answer",
				)
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("repeat-type")
				.setDescription("the repeat type, duh")
				.addChoices(
					{
						name: "All, questions and images",
						value: "all",
					},
					{
						name: "Questions, but not images",
						value: "questions",
					},
					{ name: "None", value: "none" },
				)
				.setRequired(true),
		),
	async execute(interaction: ChatInputCommandInteraction) {
		if (!interaction.channel)
			return interaction.reply({
				content: "Failed to find your channel",
				flags: [MessageFlags.Ephemeral],
			});
		const channel = returnAsTextBased(interaction.channel);
		if (channel instanceof Error)
			return interaction.reply({
				content: "uhh asdfasdf",
				flags: [MessageFlags.Ephemeral],
			});
		const [title, pool, repeat] = [
			"title",
			"pool",
			"repeat-type",
		].map((option) => interaction.options.getString(option));
		const rounds = interaction.options.getNumber("rounds");
		const ansWindow =
			interaction.options.getNumber("answer-window");
		if (!title || !pool || !repeat || !rounds || !ansWindow)
			return interaction.reply({
				content: "Failed to get some of your inputs",
				flags: [MessageFlags.Ephemeral],
			});
		if (!isRepeatType(repeat))
			return interaction.reply({
				content: "That repeat type is invalid",
				flags: [MessageFlags.Ephemeral],
			});
		const actualPool = pool === "all" ? Object.keys(pools) : pool;
		const quiz: PreQuiz = {
			title,
			delay: 5,
			pool: actualPool,
			rounds,
			ansWindow,
			repeat,
		};
		const result = await newQuiz(channel, quiz);
		return interaction.reply({
			content: result,
			flags: [MessageFlags.Ephemeral],
		});
	},
};

export default testQuizCommand;
