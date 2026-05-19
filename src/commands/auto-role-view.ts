import {
	SlashCommandBuilder,
	EmbedBuilder,
	type ChatInputCommandInteraction,
} from 'discord.js';
import mongoose from 'mongoose';
import type {IRule} from '../lib/models.js';

export const autoRoleViewCommand = {
	data: new SlashCommandBuilder()
		.setName('autoroleview')
		.setDescription('View all autorole rules'),

	async execute(interaction: ChatInputCommandInteraction) {
		const rule = mongoose.model<IRule>('Rule');
		const rules = await rule.find();

		if (rules.length === 0)
			return interaction.reply('No rules found in cloud.');

		const embed = new EmbedBuilder()
			.setTitle('Active Autorole Rules')
			.setColor('#F1C40F');

		const list = rules
			.map((r) => {
				return `\`${r.ruleId}\` <@${r.watchUser}> triggers on <@${r.targetUser}>. Adds <@&${r.addRole}> and restores <@&${r.restoreRole}>. Duration: ${r.durationMs / 60_000}m\n`;
			})
			.join('\n---\n');

		embed.setDescription(list);
		await interaction.reply({embeds: [embed]});
	},
};
