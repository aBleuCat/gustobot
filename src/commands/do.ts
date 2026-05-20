import {
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
} from 'discord.js';
import mongoose from 'mongoose';
import type {IActionResponse} from '../lib/models.js';

export const doCommand = {
	data: new SlashCommandBuilder()
		.setName('do')
		.setDescription('Tell the bot to do something')
		.addStringOption((option) =>
			option
				.setName('action')
				.setDescription('What should I do?')
				.setRequired(true),
		),
	async execute(interaction: ChatInputCommandInteraction) {
		const {options} = interaction;
		const actionInput = options.getString('action')?.toLowerCase();
		if (!actionInput)
			return interaction.reply(
				"Something exploded and I didn't get your input",
			);
		// eslint-disable-next-line @typescript-eslint/naming-convention
		const ActionResponse =
			mongoose.model<IActionResponse>('ActionResponse');

		// Check database for triggers
		const allActions = await ActionResponse.find({});
		const matched = allActions.find((entry) =>
			actionInput.includes(entry.trigger.toLowerCase()),
		);

		if (matched) {
			return interaction.reply(
				`> **Request:** ${actionInput}\n${matched.response}`,
			);
		}

		// Default dumb reasons
		const dumbReasons = [
			'I would, but I just sat down and my legs are asleep',
			"I'm gooning rn try again later",
			"I'm doing the gizmos rn",
			"I don't like you, so no",
			"You're a fucking racist, get away from me",
			"I'm on strike rn, no can do",
			"I would, but actually no, I wouldn't, would never, go away, never come back",
			'Nah you got that',
			'Too busy not doing my learning log',
			"I would, but it's too far away",
			'Are you schizo or smth?',
		];

		const randomReason =
			dumbReasons[Math.floor(Math.random() * dumbReasons.length)];
		return interaction.reply(
			`> **Request:** ${actionInput}\n${randomReason}`,
		);
	},
};
