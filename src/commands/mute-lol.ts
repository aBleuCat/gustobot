import {
	SlashCommandBuilder,
	PermissionFlagsBits,
	type ChatInputCommandInteraction,
} from 'discord.js';
import mongoose from 'mongoose';
import type {IMutedChannel} from '../lib/models.js';

const muteLolCommand = {
	data: new SlashCommandBuilder()
		.setName('mutelol')
		.setDescription(
			'Stop the bot from saying lol in a specific channel',
		)
		.addChannelOption((option) =>
			option
				.setName('channel')
				.setDescription('The channel to mute/unmute')
				.setRequired(true),
		)
		.setDefaultMemberPermissions(
			PermissionFlagsBits.ManageChannels,
		),

	async execute(interaction: ChatInputCommandInteraction) {
		const channel = interaction.options.getChannel('channel');
		// eslint-disable-next-line @typescript-eslint/naming-convention
		const MutedChannel =
			mongoose.model<IMutedChannel>('MutedChannel');

		if (!channel)
			return interaction.reply({
				content:
					'uh oh smth went wrong didnt get ur inputs try again',
			});

		const existing = await MutedChannel.findOne({
			channelId: channel.id,
		});

		if (existing) {
			await existing.deleteOne();
			return interaction.reply(
				`I will now say "lol" in ${channel.name} again.`,
			);
		}

		await new MutedChannel({channelId: channel.id}).save();
		return interaction.reply(
			`I will no longer say "lol" in ${channel.name}.`,
		);
	},
};
