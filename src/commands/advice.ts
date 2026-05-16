import {
	SlashCommandBuilder,
	EmbedBuilder,
	type ChatInputCommandInteraction,
	MessageFlags,
} from 'discord.js';
import mongoose from 'mongoose';
import type {IAdvice} from '../lib/models.js';

export const adviceCommand = {
	data: new SlashCommandBuilder()
		.setName('advice')
		.setDescription('Get advice for your question')
		.setContexts([0, 1, 2])
		.setIntegrationTypes([0, 1])
		.addStringOption((option) =>
			option
				.setName('question')
				.setDescription('What do you need advice on?')
				.setRequired(true),
		),

	async execute(interaction: ChatInputCommandInteraction) {
		const advice = mongoose.model<IAdvice>('Advice');
		const question = interaction.options.getString('question');

		// Fetch all advice from DB
		const allAdvice = await advice.find({});

		if (allAdvice.length === 0) {
			return interaction.reply({
				content:
					'The database is empty! Use `/advicegive` to add some wisdom first.',
				ephemeral: true,
			});
		}

		// Pick a random one
		const randomAdvice =
			allAdvice[Math.floor(Math.random() * allAdvice.length)];
		if (!randomAdvice) {
			return interaction.reply({
				content: 'Something went wrong fetching the advice.',
				flags: [MessageFlags.Ephemeral],
			});
		}

		const embed = new EmbedBuilder()
			.setTitle(`The Oracle Provides...`)
			.setColor('#6463FA')
			.addFields(
				{name: 'Your Question:', value: question ?? 'idk'},
				{name: 'Advice:', value: randomAdvice.content},
			)
			.setFooter({
				text: `Wise words of wisdom shared by a fellow user`,
			});

		await interaction.reply({embeds: [embed]});
	},
};
