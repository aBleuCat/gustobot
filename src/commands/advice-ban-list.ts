import {
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
	MessageFlags,
	EmbedBuilder,
} from 'discord.js';
import mongoose from 'mongoose';
import type {IAdviceBan} from '../lib/models.js';

const adviceBanListCommand = {
	data: new SlashCommandBuilder()
		.setName('advicebanlist')
		.setDescription(
			'Shows all users currently banned from giving advice.',
		),
	async execute(interaction: ChatInputCommandInteraction) {
		await interaction.deferReply({flags: [MessageFlags.Ephemeral]});
		// eslint-disable-next-line @typescript-eslint/naming-convention
		const AdviceBans = await mongoose
			.model<IAdviceBan>('AdviceBan')
			.find({});
		if (!AdviceBans || AdviceBans.length === 0) {
			await interaction.editReply({
				content: 'There are no banned users as of now',
			});
		}

		const formattedList = AdviceBans.map(
			(user, index) => `${index + 1}. @<${user.userId}>`,
		).join('\n');
		const listEmbed = new EmbedBuilder()
			.setTitle('These poeples are very bad boys')
			.setDescription(formattedList)
			.setColor('#ff0000')
			.setTimestamp();
		await interaction.editReply({embeds: [listEmbed]});
	},
};

export default adviceBanListCommand;
