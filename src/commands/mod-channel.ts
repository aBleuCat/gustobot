import {
	SlashCommandBuilder,
	PermissionFlagsBits,
	MessageFlags,
	type ChatInputCommandInteraction,
	InteractionContextType,
	ApplicationIntegrationType,
} from 'discord.js';
import {ModChannel} from '../lib/models.js';

/* eslint-disable @typescript-eslint/naming-convention */
const {Guild} = InteractionContextType;
const {GuildInstall} = ApplicationIntegrationType;
/* eslint-enable @typescript-eslint/naming-convention */

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
		.setDefaultMemberPermissions(
			PermissionFlagsBits.Administrator,
		)
		.setContexts([Guild])
		.setIntegrationTypes([GuildInstall]),

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

		await interaction.deferReply({
			flags: [MessageFlags.Ephemeral],
		});

		const channel = interaction.options.getChannel('channel');

		if (!interaction.member || !interaction.guild || !channel)
			return interaction.reply({
				content:
					'uhh something exploded and couldnt get your info',
			});

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
