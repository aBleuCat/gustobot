import {
	SlashCommandBuilder,
	PermissionFlagsBits,
	MessageFlags,
	type ChatInputCommandInteraction,
} from 'discord.js';
import mongoose from 'mongoose';

const modChannelConfig = {
	data: new SlashCommandBuilder()
		.setName('modchannel')
		.setDescription('Set the channel for bot activity logs')
		.addChannelOption((option) =>
			option
				.setName('channel')
				.setDescription('The channel to log to')
				.setRequired(true),
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.setContexts(0),

	async execute(interaction: ChatInputCommandInteraction) {
		if (
			!interaction.memberPermissions?.has(
				PermissionFlagsBits.Administrator,
			)
		) {
			return interaction.editReply({
				content: 'who do you think you are?',
			});
		}

		await interaction.deferReply({flags: [MessageFlags.Ephemeral]});

		const channel = interaction.options.getChannel('channel');

		if (!interaction.member || !interaction.guild || !channel)
			return interaction.reply({
				content: 'uhh something exploded and couldnt get your info',
			});
		// eslint-disable-next-line @typescript-eslint/naming-convention
		const ModChannel = mongoose.model('ModChannel');

		// Update if exists, otherwise create new
		await ModChannel.findOneAndUpdate(
			{guildId: interaction.guild.id},
			{channelId: channel.id},
			{upsert: true},
		);

		await interaction.editReply({
			content: `Mod channel set to <#${channel.id}> for logging bot actions.`,
		});
	},
};

export default modChannelConfig;
