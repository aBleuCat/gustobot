import {
	SlashCommandBuilder,
	MessageFlags,
	type ChatInputCommandInteraction,
} from 'discord.js';
import {type SlashCommandConfig} from '../types.js';
import {immutConfig} from '../lib/config.js';

const DM_ALLOWED_USER_IDS: ReadonlySet<string> = immutConfig.admins;

const dmCommand: SlashCommandConfig = {
	data: new SlashCommandBuilder()
		.setName('dm')
		.setDescription('Makes the bot DM a specific user')
		.addUserOption((option) =>
			option
				.setName('user')
				.setDescription('The user to message')
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName('message')
				.setDescription('The message to send')
				.setRequired(true),
		),

	async execute(interaction: ChatInputCommandInteraction) {
		if (!DM_ALLOWED_USER_IDS.has(interaction.user.id)) {
			await interaction.reply({
				content: 'You do not have permission to use this command.',
				flags: [MessageFlags.Ephemeral],
			});
			return;
		}

		const targetUser = interaction.options.getUser('user', true);
		const messageText = interaction.options.getString(
			'message',
			true,
		);

		try {
			await targetUser.send(messageText);
			await interaction.reply({
				content: `Successfully sent message to **${targetUser.displayName}**.`,
				flags: [MessageFlags.Ephemeral],
			});
		} catch (error) {
			console.error(error);
			await interaction.reply({
				content: `I couldn't DM **${targetUser.displayName}**. They might have their DMs closed.`,
				flags: [MessageFlags.Ephemeral],
			});
		}
	},
};

export default dmCommand;
