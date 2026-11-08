import {
	SlashCommandSubcommandBuilder,
	MessageFlags,
	type ChatInputCommandInteraction,
} from "discord.js";
import { CatchRiddles } from "../../lib/models.js";

const regexFlagChoices = [
	{ name: "Case-insensitive + Unicode (iv)", value: "iv" },
	{ name: "Case-insensitive (i)", value: "i" },
	{ name: "Unicode (v)", value: "v" },
];

export const data = new SlashCommandSubcommandBuilder()
	.setName("createriddle")
	.setDescription("Add a riddle to the horse-catching pool")
	.addStringOption((option) =>
		option
			.setName("riddle")
			.setDescription("The riddle shown when a horse appears")
			.setRequired(true)
			.setMaxLength(1000),
	)
	.addStringOption((option) =>
		option
			.setName("answer-regex")
			.setDescription(
				"Regex pattern for accepted answers (without / delimiters)",
			)
			.setRequired(true)
			.setMaxLength(1000),
	)
	.addIntegerOption((option) =>
		option
			.setName("lowest-rarity")
			.setDescription(
				"Lowest horse rarity this riddle can be used for",
			)
			.setRequired(true)
			.setMinValue(0),
	)
	.addIntegerOption((option) =>
		option
			.setName("highest-rarity")
			.setDescription(
				"Highest horse rarity this riddle can be used for",
			)
			.setRequired(true)
			.setMinValue(0),
	)
	.addNumberOption((option) =>
		option
			.setName("weight")
			.setDescription(
				"Relative selection chance among matching riddles",
			)
			.setRequired(false)
			.setMinValue(0.01)
			.setMaxValue(1_000_000),
	)
	.addStringOption((option) =>
		option
			.setName("regex-flags")
			.setDescription("Flags used to match the answer")
			.setRequired(false)
			.addChoices(...regexFlagChoices),
	);

export async function execute(
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const riddle = interaction.options
		.getString("riddle", true)
		.trim();
	const answerPattern = interaction.options
		.getString("answer-regex", true)
		.trim();
	const lowestRarity = interaction.options.getInteger(
		"lowest-rarity",
		true,
	);
	const highestRarity = interaction.options.getInteger(
		"highest-rarity",
		true,
	);
	const weight = interaction.options.getNumber("weight") ?? 1;
	const regexFlags =
		interaction.options.getString("regex-flags") ?? "iv";

	if (!riddle || !answerPattern) {
		await interaction.reply({
			content: "The riddle and answer regex cannot be blank.",
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	if (highestRarity < lowestRarity) {
		await interaction.reply({
			content:
				"Highest rarity must be greater than or equal to lowest rarity.",
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	let answer: RegExp;
	try {
		answer = new RegExp(answerPattern, regexFlags);
	} catch (error: unknown) {
		const reason =
			error instanceof Error ? error.message : String(error);
		await interaction.reply({
			content: `Invalid answer regex: ${reason}`,
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	await interaction.deferReply({
		flags: [MessageFlags.Ephemeral],
	});
	await CatchRiddles.create({
		riddle,
		answer,
		lowestRarity,
		highestRarity,
		weight,
	});
	await interaction.editReply(
		`Added riddle for horse rarities ${lowestRarity}–${highestRarity} with weight ${weight}.`,
	);
}
