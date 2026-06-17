import {
	SlashCommandBuilder,
	PermissionFlagsBits,
	ChannelType,
	type ChatInputCommandInteraction,
	MessageFlags,
	InteractionContextType,
	ApplicationIntegrationType,
} from "discord.js";
import { MutedChannel } from "../lib/models.js";
/* eslint-disable @typescript-eslint/naming-convention */
const { Guild } = InteractionContextType;
const { GuildInstall } = ApplicationIntegrationType;
/* eslint-enable @typescript-eslint/naming-convention */
const muteLolAll = {
	data: new SlashCommandBuilder()
		.setName("mute_lol_all")
		.setDescription("mutes triggers in all channels")
		.addBooleanOption((option) =>
			option
				.setName("status")
				.setDescription("true to mute, false to unmute")
				.setRequired(true),
		)
		.addChannelOption((option) =>
			option
				.setName("exception")
				.setDescription("channel to ignore"),
		)
		.setContexts([Guild])
		.setIntegrationTypes([GuildInstall]),
	async execute(interaction: ChatInputCommandInteraction) {
		// Check perms
		if (
			!interaction.memberPermissions?.has(
				PermissionFlagsBits.ManageChannels,
			)
		) {
			return interaction.reply({
				content: "you have no permission to do this",
				flags: [MessageFlags.Ephemeral],
			});
		}

		const status = interaction.options.getBoolean("status");
		const exception = interaction.options.getChannel("exception");
		const channels = interaction.guild?.channels.cache.filter(
			(c) => c.type === ChannelType.GuildText,
		);
		const targetChannelIds = channels
			?.filter((_, id) => id !== exception?.id)
			.map((_, id) => id);
		if (!targetChannelIds)
			return interaction.reply({
				content: "r u even in a server?",
			});
		if (status) {
			// Mute all
			const operations = targetChannelIds.map((id) => ({
				updateOne: {
					filter: { channelId: id },
					update: { channelId: id },
					upsert: true,
				},
			}));

			if (operations.length > 0) {
				await MutedChannel.bulkWrite(operations);
			}

			return interaction.reply(
				`muted all channels ${exception ? `except ${exception.toString()}` : ""}`,
			);
		}

		// Unmute all
		await MutedChannel.deleteMany({
			channelId: { $in: targetChannelIds },
		});

		if (targetChannelIds.length > 0)
			return interaction.reply("unmuted all channels");
	},
};

export default muteLolAll;
