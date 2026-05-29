import {
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
	MessageFlags,
} from 'discord.js';
import mongoose from 'mongoose';
import type {IActionResponse} from '../lib/models.js';
import {immutConfig} from '../lib/config.js';

const {admins} = immutConfig;

const actionConfigCommand = {
	data: new SlashCommandBuilder()
		.setName('howtoact')
		.setDescription('Teach the bot how to respond to an action')
		.addStringOption((option) =>
			option
				.setName('trigger')
				.setDescription('The word to look for')
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName('response')
				.setDescription('The bot response')
				.setRequired(true),
		),
	async execute(interaction: ChatInputCommandInteraction) {
		if (!admins.has(interaction.user.id)) {
			return interaction.reply({
				content: "You can't do that brochacho",
				flags: [MessageFlags.Ephemeral],
			});
		}

		// eslint-disable-next-line @typescript-eslint/naming-convention
		const ActionResponse =
			mongoose.model<IActionResponse>('ActionResponse');
		const trigger = interaction.options.getString('trigger');
		const response = interaction.options.getString('response');
		if (!trigger || !response)
			return interaction.reply({
				content: "Lo siento but your inputs didn't go through",
			});

		await ActionResponse.findOneAndUpdate(
			{trigger: trigger.toLowerCase()},
			{response},
			{upsert: true},
		);

		return interaction.reply({
			content: `Ok mister sir, when someone says **${trigger}**, I'll say **${response}**`,
			flags: [MessageFlags.Ephemeral],
		});
	},
};

export default actionConfigCommand;
