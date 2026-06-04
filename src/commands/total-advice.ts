import {
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
	MessageFlags,
} from 'discord.js';
import mongoose from 'mongoose';
import type {IAdvice} from '../lib/models.js';

const totalAdviceCommand = {
	data: new SlashCommandBuilder()
		.setName('totaladvice')
		.setDescription(
			'Shows the total number of advice entries and the top contributor',
		),

	async execute(interaction: ChatInputCommandInteraction) {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		const Advice = mongoose.model<IAdvice>('Advice');

		const count = await Advice.countDocuments();

		type TopContributorResult = {
			_id: string;
			count: number;
		};

		// Aggregation to find the most frequent authorId
		const topStats = await Advice.aggregate<TopContributorResult>(
			[
				{$group: {_id: '$authorId', count: {$sum: 1}}},
				{$sort: {count: -1}},
				{$limit: 1},
			],
		);

		let topText = '';
		if (topStats[0] && topStats.length > 0) {
			const topUser = await interaction.client.users
				.fetch(topStats[0]._id)
				.catch(() => undefined);
			topText = `\n**Top Contributor:** ${topUser ? topUser.username : 'Unknown'} (${topStats[0].count} entries)`;
		}

		return interaction.reply(
			`There are currently **${count}** pieces of wisdom in the circle.${topText}`,
		);
	},
};
