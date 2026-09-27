import {
	SlashCommandSubcommandBuilder,
	type ChatInputCommandInteraction,
} from "discord.js";
import { config, immutConfig } from "../../lib/config.js";
import rawHorseValues from "../../data/horses.json" with { type: "json" };
import { castAsHorseData } from "../../type-utils.js";

const horseDataCatalog = castAsHorseData(rawHorseValues);

export const data = new SlashCommandSubcommandBuilder()
	.setName("probabilities")
	.setDescription("Check horse probabilities");

export async function execute(
	interaction: ChatInputCommandInteraction,
) {
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
		return `${nameTag.padEnd(35)} | ${s.prob}% | 1 in ${s.msgFreq}`;
	});

	const header = `Name                                | Prob       | Avg Messages\n${"-".repeat(70)}`;
	const footer = `\nTotal chance for ANY horse: ${(totalRate * 100).toFixed(4)}%\nAverage 1 horse every ${Math.round(1 / totalRate)} messages.`;

	let fullTable = `\`\`\`\n${header}\n${statsLines.join("\n")}\n${footer}\n\`\`\``;
	if (fullTable.length > immutConfig.DISCORD_MSG_SAFE_CHAR_LIMIT) {
		const overflow = fullTable.length - immutConfig.DISCORD_MSG_SAFE_CHAR_LIMIT;
		const keepCount = Math.max(0, statsLines.length - Math.ceil(overflow / 60));
		fullTable = `\`\`\`\n${header}\n${statsLines.slice(0, keepCount).join("\n")}\n...\n${footer}\n\`\`\``;
	}

	return interaction.reply({ content: fullTable });
}
