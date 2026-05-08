const {SlashCommandBuilder, MessageFlags} = require('discord.js');
const mongoose = require('mongoose');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('coincount')
		.setDescription('Check horse coin balance')
		.addUserOption((option) =>
			option
				.setName('user')
				.setDescription('User to check (optional, defaults to you)')
				.setRequired(false),
		),
	async execute(interaction) {
		const UserHorses = mongoose.model('UserHorses');
		const targetUser = interaction.options.getUser('user') || interaction.user;
		const inventory = await UserHorses.findOne({userId: targetUser.id});
		const coins = inventory?.horseCoins || 0;

		return interaction.reply({
			content: `<@${targetUser.id}> has **${coins}** 🪙 Horse Coin${coins === 1 ? '' : 's'}`,
		});
	},
};
