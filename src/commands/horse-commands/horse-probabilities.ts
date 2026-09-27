import {
	SlashCommandSubcommandBuilder,
	type ChatInputCommandInteraction,
	EmbedBuilder,
	MessageFlags,
} from "discord.js";
import { config } from "../../lib/config.js";
import rawHorseValues from "../../data/horses.json" with { type: "json" };
import { castAsHorseData } from "../../type-utils.js";

const horseDataCatalog = castAsHorseData(rawHorseValues);

export const data = new SlashCommandSubcommandBuilder()
	.setName("probabilities")
	.setDescription("Check horse probabilities")
	.addBooleanOption((option) =>
		option
			.setName("ephemeral")
			.setDescription("Show the results only to you (defaults to true)"),
	);

export async function execute(
	interaction: ChatInputCommandInteraction,
) {
	const isEphemeral = interaction.options.getBoolean("ephemeral") ?? true;
	await interaction.deferReply({
		flags: isEphemeral ? [MessageFlags.Ephemeral] : [],
	});

	const calculateChance = (rarity: number) => {
		const denominator =
			rarity * config.SPAWN_COEFFICIENT * config.ANTIINFLATOR;
		return 1 / denominator;
	};

	let totalRate = 0;

	const horseStats = Object.values(horseDataCatalog)
		.map((horse) => {
			const chance = calculateChance(horse.rarity);
			const isSpawnable = horse.spawn !== false;

			if (isSpawnable) {
				totalRate += chance;
			}

			return {
				name: horse.name,
				rarity: horse.rarity,
				prob: (chance * 100).toFixed(5),
				msgFreq: Math.round(1 / chance).toLocaleString(),
				isSpawnable,
			};
		})
		.toSorted((a, b) => b.rarity - a.rarity);

	const statsLines = horseStats.map((s) => {
		const nameTag = s.isSpawnable
			? s.name
			: `[NOSPAWN] ${s.name}`;
		return `${nameTag.padEnd(35)} | ${String(s.rarity).padStart(5)} | ${s.prob.padStart(8)}% | 1 in ${s.msgFreq}`;
	});

	const header = "Name                                | Rarity | Probability | Avg Messages";
	const descriptionPrefix = "```\n" + header + "\n" + "-".repeat(header.length) + "\n";
	const descriptionSuffix = "\n```";
	const maxLinesLength = 4096 - descriptionPrefix.length - descriptionSuffix.length;
	const pages: string[][] = [];
	let currentPage: string[] = [];
	let currentLength = 0;

	for (const line of statsLines) {
		const lineLength = line.length + (currentPage.length > 0 ? 1 : 0);
		if (currentLength + lineLength > maxLinesLength && currentPage.length > 0) {
			pages.push(currentPage);
			currentPage = [];
			currentLength = 0;
		}

		currentPage.push(line);
		currentLength += line.length + (currentPage.length > 1 ? 1 : 0);
	}

	if (currentPage.length > 0) {
		pages.push(currentPage);
	}

	const footer = `Total spawn chance: ${(totalRate * 100).toFixed(4)}% | Average: 1 horse every ${Math.round(1 / totalRate)} messages`;
	const embeds = pages.map((lines, index) =>
		new EmbedBuilder()
			.setColor("#6463FA")
			.setTitle(`Horse Spawn Probabilities (${index + 1}/${pages.length})`)
			.setDescription(`${descriptionPrefix}${lines.join("\n")}${descriptionSuffix}`)
			.setFooter({ text: footer }),
	);

	await interaction.editReply({ embeds: [embeds[0]!] });
	await Promise.all(
		embeds.slice(1).map(async (embed) =>
			interaction.followUp({
			embeds: [embed],
			flags: isEphemeral ? [MessageFlags.Ephemeral] : [],
			}),
		),
	);
}
