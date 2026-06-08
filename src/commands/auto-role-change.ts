import {
	SlashCommandBuilder,
	MessageFlags,
	type ChatInputCommandInteraction,
} from 'discord.js';
import {Rule} from '../lib/models.js';
import {immutConfig} from '../lib/config.js';

const autoRoleSetupCommand = {
	data: new SlashCommandBuilder()
		.setName('autorolechange')
		.setDescription('Owner Only: Configure autorole swap rules')
		.addUserOption((option) =>
			option
				.setName('messager')
				.setDescription('The user whose mentions to watch')
				.setRequired(true),
		)
		.addUserOption((option) =>
			option
				.setName('target_user')
				.setDescription(
					'The user who will receive the role swap',
				)
				.setRequired(true),
		)
		.addRoleOption((option) =>
			option
				.setName('add_role')
				.setDescription('Role to give the target')
				.setRequired(true),
		)
		.addRoleOption((option) =>
			option
				.setName('restore_role')
				.setDescription('Role to restore for the target')
				.setRequired(true),
		)
		.addIntegerOption((option) =>
			option
				.setName('duration')
				.setDescription('Duration in minutes')
				.setRequired(true),
		)
		.addChannelOption((option) =>
			option
				.setName('channel')
				.setDescription(
					'The channel where this rule triggers',
				)
				.setRequired(true),
		),

	async execute(interaction: ChatInputCommandInteraction) {
		if (!immutConfig.ADMINS.has(interaction.user.id)) {
			return interaction.reply({
				content: 'Owner only.',
				flags: [MessageFlags.Ephemeral],
			});
		}

		const watchUser = interaction.options.getUser('messager');
		const targetUser = interaction.options.getUser('target_user');
		const addRole = interaction.options.getRole('add_role');
		const restoreRole =
			interaction.options.getRole('restore_role');
		const duration = interaction.options.getInteger('duration');
		const targetChannel =
			interaction.options.getChannel('channel');
		if (!duration) {
			return interaction.reply(
				'Something went wrong when getting your inputs, please try again',
			);
		}

		if (
			!watchUser ||
			!targetUser ||
			!addRole ||
			!restoreRole ||
			!targetChannel
		) {
			throw new Error('One or more options failed to send.');
		}

		const newRuleId = Math.floor(
			100_000 + Math.random() * 900_000,
		).toString();

		await Rule.findOneAndUpdate(
			{
				watchUser: watchUser.id,
				targetUser: targetUser.id,
				channel: targetChannel.id,
			},
			{
				ruleId: newRuleId,
				addRole: addRole.id,
				restoreRole: restoreRole.id,
				durationMs: duration * 60_000,
			},
			{upsert: true},
		);

		return interaction.reply(
			`**Rule Set** ID: \`${newRuleId}\`\nIn ${String(targetChannel)}, if **${watchUser.username}** mentions **${targetUser.username}**, they get **${addRole.name}** for ${duration}m before restoring to ${restoreRole.name}`,
		);
	},
};

export default autoRoleSetupCommand;
