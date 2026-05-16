import {
	SlashCommandBuilder,
	MessageFlags,
	type ChatInputCommandInteraction,
} from 'discord.js';
import mongoose from 'mongoose';
import type {IAdvice, IAdviceBan} from '../lib/models.js';

export const adviceGiveCommand = {
	data: new SlashCommandBuilder()
		.setName('advicegive')
		.setDescription(
			'Add a piece of advice to the goon circle of advice',
		)
		.setContexts([0, 1, 2])
		.setIntegrationTypes([0, 1])
		.addStringOption((option) =>
			option
				.setName('text')
				.setDescription('The advice')
				.setRequired(true),
		),

	async execute(interaction: ChatInputCommandInteraction) {
		const advice = mongoose.model<IAdvice>('Advice');
		const adviceBan = mongoose.model<IAdviceBan>('AdviceBan');
		const text = interaction.options.getString('text')?.trim();

		// Check if the user is banned
		const isBanned = await adviceBan.findOne({
			userId: interaction.user.id,
		});
		if (isBanned) {
			return interaction.reply({
				content:
					'You are banned from contributing wisdom to the circle.',
				flags: [MessageFlags.Ephemeral],
			});
		}

		// Character limit check (100 chars)
		if (!text) {
			await interaction.reply({
				content:
					'oopsie poopsie something went wrong when recieving your wisdom uh oh',
				flags: [MessageFlags.Ephemeral],
			});
			console.error('Error when recieving text for advice');
			return;
		}

		if (text.length > 100) {
			return interaction.reply({
				content: `That's too much wisdom! Please keep it under 100 characters (Current: ${text.length}).`,
				flags: [MessageFlags.Ephemeral],
			});
		}

		if (text.length < 3) {
			return interaction.reply({
				content: 'Wisdom must be at least 3 characters long.',
				flags: [MessageFlags.Ephemeral],
			});
		}

		// Duplicate check (Case-insensitive)
		const existingAdvice = await advice
			.findOne({
				content: text,
			})
			.collation({locale: 'en', strength: 2});

		if (existingAdvice) {
			return interaction.reply({
				content:
					'This wisdom has already been propagated. Try something more original.',
				flags: [MessageFlags.Ephemeral],
			});
		}

		// Save
		// eslint-disable-next-line new-cap
		const newAdvice = new advice({
			content: text,
			authorId: interaction.user.id,
		});
		await newAdvice.save();
		await interaction.reply({
			content: 'Your wisdom shall be propagated',
			flags: [MessageFlags.Ephemeral],
		});
	},
};
