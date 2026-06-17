import {
	SlashCommandSubcommandBuilder,
	type ChatInputCommandInteraction,
	MessageFlags,
	EmbedBuilder,
} from 'discord.js';
import rawHorseValues from '../../data/horses.json' with {type: 'json'};
import {castAsHorseData} from '../../type-utils.js';
import {config} from '../../lib/config.js';

const calculateChance = (value: number) => {
	const denominator =
		value * config.SPAWN_COEFFICIENT * config.ANTIINFLATOR;
	return 1 / denominator;
};

const horsesData = castAsHorseData(rawHorseValues);

export const data = new SlashCommandSubcommandBuilder()
	.setName('wheel')
	.setDescription('Spin the horse wheel');

export async function execute(
	interaction: ChatInputCommandInteraction,
) {
	const spawnableHorseEntries = Object.entries(horsesData).filter(
		([, horse]) => horse.spawn !== false,
	);

	if (spawnableHorseEntries.length === 0) {
		return interaction.reply({
			content: 'No horses are currently set to spawn!',
			flags: MessageFlags.Ephemeral,
		});
	}

	const pool = spawnableHorseEntries.map(([key, horse]) => ({
		key,
		horse,
		weight: calculateChance(horse.value),
	}));

	const totalWeight = pool.reduce((sum, h) => sum + h.weight, 0);
	let random = Math.random() * totalWeight;

	const selectedItem =
		pool.find((item) => {
			if (random < item.weight) {
				return true;
			}

			random -= item.weight;
			return false;
		}) ?? pool.at(-1)!;

	const selectedHorse = selectedItem.horse;

	const chance = calculateChance(selectedHorse.value);
	const embed = new EmbedBuilder()
		.setTitle(`Woah the wheel landed on...`)
		.setColor(
			selectedHorse.value > config.FLAIR_THRESHOLD_VALUE
				? '#FFD700'
				: '#6463FA',
		)
		.setDescription(`You rolled: **${selectedHorse.name}**`)
		.addFields(
			{
				name: 'Value',
				value: `${selectedHorse.value}`,
				inline: true,
			},
			{
				name: 'Rarity',
				value: `1 in ${Math.round(1 / chance).toLocaleString()} msgs`,
				inline: true,
			},
		);

	if (selectedHorse.link?.startsWith('http')) {
		embed.setImage(selectedHorse.link);
	}

	await interaction.reply({embeds: [embed]});
}
