import {
	SlashCommandBuilder,
	PermissionFlagsBits,
	MessageFlags,
	type ChatInputCommandInteraction,
} from 'discord.js';
import mongoose from 'mongoose';
import type {IRule} from '../lib/models.js';

export const autoRoleRemoveCommand = {
	data: new SlashCommandBuilder()
		.setName('autoroleremove')
		.setDescription('Remove an autorole trigger by its ID')
		.addStringOption((option) =>
			option
				.setName('id')
				.setDescription('The 6-digit ID of the rule')
				.setRequired(true),
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

	async execute(interaction: ChatInputCommandInteraction) {
		if (interaction.user.id !== '934290747623096381') {
			return interaction.reply({
				content: 'Owner only.',
				flags: [MessageFlags.Ephemeral],
			});
		}

		const id = interaction.options.getString('id');

		// eslint-disable-next-line @typescript-eslint/naming-convention
		const Rule = mongoose.model<IRule>('Rule');
		const result = await Rule.deleteOne({ruleId: id});

		if (result.deletedCount === 0) {
			return interaction.reply({
				content: `Could not find a rule with ID \`${id}\` in the database.`,
				flags: [MessageFlags.Ephemeral],
			});
		}

		await interaction.reply({
			content: `Rule \`${id}\` has been removed from the cloud database.`,
			flags: [MessageFlags.Ephemeral],
		});
	},
};
