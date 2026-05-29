import {
	SlashCommandBuilder,
	EmbedBuilder,
	type ChatInputCommandInteraction,
	MessageFlags,
} from 'discord.js';
import rawHorseValues from '../../data/horses.json' with {type: 'json'};
import {castAsHorseData} from '../../type-utils.js';

const HORSE_VALUES = castAsHorseData(rawHorseValues);

export const data = new SlashCommandBuilder()
	.setName('slugs')
	.setDescription('List all horse name to slug mappings.');
export async function execute(
	interaction: ChatInputCommandInteraction,
) {
	const mappings = Object.entries(HORSE_VALUES)
		.map(([slug, data]) => `• **${data.name}** → ${slug}`)
		.join('\n');
	const embed = new EmbedBuilder()
		.setTitle('Horse Name → Slug Mappings')
		.setDescription(mappings)
		.setColor('#8b4513');
	await interaction.reply({
		embeds: [embed],
		flags: [MessageFlags.Ephemeral],
	});
}
