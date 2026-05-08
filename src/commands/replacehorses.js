const {SlashCommandBuilder} = require('discord.js');
const mongoose = require('mongoose');
const HORSE_VALUES = require('../horses.json');

const OWNER_ID = '934290747623096381';

function horseName(slug) {
	return HORSE_VALUES[slug]?.name ?? slug;
}

const horseChoices = Object.keys(HORSE_VALUES).map((slug) => ({
	name: horseName(slug),
	value: slug,
}));

module.exports = {
	data: new SlashCommandBuilder()
		.setName('replacehorses')
		.setDescription(
			"Replace everyone's horse of one type with another (owner only)",
		)
		.addStringOption((o) =>
			o
				.setName('horse')
				.setDescription('The horse to replace')
				.setRequired(true)
				.addChoices(...horseChoices.slice(0, 25)),
		)
		.addStringOption((o) =>
			o
				.setName('replacement')
				.setDescription('The horse to replace it with')
				.setRequired(true)
				.addChoices(...horseChoices.slice(0, 25)),
		),

	async execute(interaction) {
		if (interaction.user.id !== OWNER_ID) {
			return interaction.reply({content: 'no can do', ephemeral: true});
		}

		await interaction.deferReply({ephemeral: true});

		const UserHorses = mongoose.model('UserHorses');
		const horseSlug = interaction.options.getString('horse');
		const replacementSlug = interaction.options.getString('replacement');

		const allUsers = await UserHorses.find({});
		let affectedUsers = 0;
		let totalReplaced = 0;

		for (const user of allUsers) {
			const count = user.horses.get(horseSlug) || 0;
			if (count <= 0) continue;

			user.horses.set(horseSlug, 0);
			user.horses.set(
				replacementSlug,
				(user.horses.get(replacementSlug) || 0) + count,
			);
			await user.save();

			affectedUsers++;
			totalReplaced += count;
		}

		return interaction.editReply(
			`Replaced **${totalReplaced}x ${horseName(horseSlug)}** with **${horseName(replacementSlug)}** across **${affectedUsers}** user(s).`,
		);
	},
};
