import {
	SlashCommandBuilder,
	MessageFlags,
	type ChatInputCommandInteraction,
} from 'discord.js';
import {Advice} from '../lib/models.js';
import {immutConfig} from '../lib/config.js';

const purgeCommand = {
	data: new SlashCommandBuilder()
		.setName('purgeadvicefromuser')
		.setDescription(
			'Deletes all advice entries submitted by a specific user (Owner Only)',
		)
		.addUserOption((option) =>
			option
				.setName('target')
				.setDescription(
					'The user whose advice you want to purge',
				)
				.setRequired(true),
		),

	async execute(interaction: ChatInputCommandInteraction) {
		if (!immutConfig.ADMINS.has(interaction.user.id)) {
			return interaction.reply({
				content:
					'You do not have permission to use this command. This is an owner-only action.',
				flags: [MessageFlags.Ephemeral],
			});
		}

		const target = interaction.options.getUser('target');
		if (!target)
			return interaction.reply({
				content:
					'uhh something went wrong when receieving ur inputs, try again',
			});
		const result = await Advice.deleteMany({
			authorId: target.id,
		});

		if (result.deletedCount === 0) {
			return interaction.reply({
				content: `No advice found from **${target.username}**.`,
				flags: [MessageFlags.Ephemeral],
			});
		}

		return interaction.reply({
			content: `Successfully purged **${result.deletedCount}** pieces of advice from **${target.username}**.`,
		});
	},
};

export default purgeCommand;
