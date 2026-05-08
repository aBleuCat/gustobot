const {SlashCommandBuilder, EmbedBuilder} = require('discord.js');
const HORSE_VALUES = require('../horses.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('horseslugs')
		.setDescription('List all horse name to slug mappings.'),
	async execute(interaction) {
		const mappings = Object.entries(HORSE_VALUES)
			.map(([slug, data]) => `• **${data.name}** → ${slug}`)
			.join('\n');
		const embed = new EmbedBuilder()
			.setTitle('Horse Name → Slug Mappings')
			.setDescription(mappings)
			.setColor(0x8b_45_13);
		await interaction.reply({embeds: [embed], ephemeral: true});
	},
};
