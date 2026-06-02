import {
	SlashCommandSubcommandBuilder,
	type ChatInputCommandInteraction,
} from 'discord.js';
import {config} from '../../lib/config.js';
import rawHorseValues from '../../data/horses.json' with {type: 'json'};
import {castAsHorseData} from '../../type-utils.js';

const horsesData = castAsHorseData(rawHorseValues);

export const data = new SlashCommandSubcommandBuilder()
	.setName('probabilities')
	.setDescription('Check horse probabilities');

export async function execute(
	interaction: ChatInputCommandInteraction,
) {
	const calculateChance = (value: number) => {
		const denominator =
			value * config.SPAWN_COEFFICIENT * config.ANTIINFLATOR;
		return 1 / denominator;
	};

	let totalRate = 0;

	const horseStats = Object.values(horsesData)
		.map((horse) => {
			const chance = calculateChance(horse.value);
			const isSpawnable = horse.spawn !== false;

			if (isSpawnable) {
				totalRate += chance;
			}

			return {
				name: horse.name,
				val: horse.value,
				prob: (chance * 100).toFixed(5),
				msgFreq: Math.round(1 / chance).toLocaleString(),
				isSpawnable,
			};
		})
		.toSorted((a, b) => b.val - a.val);

	const statsLines = horseStats.map((s) => {
		const nameTag = s.isSpawnable
			? s.name
			: `[NOSPAWN] ${s.name}`;
		return `${nameTag.padEnd(35)} | ${s.prob}% | 1 in ${s.msgFreq}`;
	});

	const header = `Name                                | Prob       | Avg Messages\n${'-'.repeat(70)}`;
	const footer = `\nTotal chance for ANY horse: ${(totalRate * 100).toFixed(4)}%\nAverage 1 horse every ${Math.round(1 / totalRate)} messages.`;

	const fullTable = `\`\`\`\n${header}\n${statsLines.join('\n')}\n${footer}\n\`\`\``;

	return interaction.reply({content: fullTable});
}
