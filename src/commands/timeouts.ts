import {
	SlashCommandBuilder,
	EmbedBuilder,
	PermissionFlagsBits,
	MessageFlags,
	type ChatInputCommandInteraction,
} from 'discord.js';
import {Timeout} from '../lib/models.js';

const timeoutViewCommand = {
	data: new SlashCommandBuilder()
		.setName('timeouts')
		.setDescription('View all active role-swaps')
		.setDefaultMemberPermissions(
			PermissionFlagsBits.ManageMessages,
		),

	async execute(interaction: ChatInputCommandInteraction) {
		const activeTimeouts = await Timeout.find({}).lean();

		if (activeTimeouts.length === 0) {
			return interaction.reply({
				content: 'There are no active role-swap timeouts.',
				flags: [MessageFlags.Ephemeral],
			});
		}

		const embed = new EmbedBuilder()
			.setTitle('⏳ Active Role Timeouts')
			.setColor('#6463FA');

		const list = activeTimeouts
			.map((t) => {
				const unixSeconds = Math.floor(t.revertAt / 1000);
				return `<@${t.targetUser}>: Has <@&${t.addRole}>, restores to <@&${t.restoreRole}> <t:${unixSeconds}:R>`;
			})
			.join('\n');

		embed.setDescription(list);
		await interaction.reply({
			embeds: [embed],
			flags: [MessageFlags.Ephemeral],
		});
	},
};

export default timeoutViewCommand;
