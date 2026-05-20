import {
	SlashCommandBuilder,
	PermissionFlagsBits,
	type ChatInputCommandInteraction,
	MessageFlags,
} from 'discord.js';
import mongoose from 'mongoose';
import type {IHorseConfig} from '../lib/models.js';
// eslint-disable-next-line @typescript-eslint/naming-convention
const HorseConfig = mongoose.model<IHorseConfig>('HorseConfig');

export const configureHorsesCommand = {
	data: new SlashCommandBuilder()
		.setName('confighorses')
		.setDescription('Configure horse spawning settings')
		.addBooleanOption((option) =>
			option
				.setName('enabled')
				.setDescription('Enable or disable spawning')
				.setRequired(true),
		)
		.addChannelOption((option) =>
			option
				.setName('channel')
				.setDescription(
					'The channel where horse spawns are announced',
				)
				.setRequired(true),
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.setContexts([0, 1, 2])
		.setIntegrationTypes([0, 1]),
	async execute(interaction: ChatInputCommandInteraction) {
		const ownerId = '934290747623096381';
		const isOwner = interaction.user.id === ownerId;
		const isAdmin = interaction.memberPermissions?.has(
			PermissionFlagsBits.Administrator,
		);
		if (!isOwner && !isAdmin) {
			return interaction.reply({
				content:
					"You don't have permission to configure horse spawning.",
				flags: [MessageFlags.Ephemeral],
			});
		}

		const enabled = interaction.options.getBoolean('enabled');
		const channel = interaction.options.getChannel('channel');
		if (!channel)
			return interaction.reply(
				'Something went wrong when trying to get your inputs',
			);

		await HorseConfig.findOneAndUpdate(
			{guildId: interaction.guildId},
			{enabled, channelId: channel.id},
			{upsert: true},
		);

		return interaction.reply({
			content: `Horse spawning now **${enabled ? 'ON' : 'OFF'}** in <#${channel.id}>.`,
			ephemeral: false,
		});
	},
};
