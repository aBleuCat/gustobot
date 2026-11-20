import {
	SlashCommandBuilder,
	PermissionFlagsBits,
	MessageFlags,
	type ChatInputCommandInteraction,
	InteractionContextType,
} from "discord.js";
import { immutConfig } from "../lib/config.js";
import { isGuildTextBased } from "../type-utils.js";

// eslint-disable-next-line @typescript-eslint/naming-convention
const { Guild } = InteractionContextType;

const sayCommand = {
	data: new SlashCommandBuilder()
		.setName("say")
		.setDescription("Make the bot say something in this channel")
		.addStringOption((option) =>
			option
				.setName("message")
				.setDescription("What should I say?")
				.setRequired(true),
		)
		.addAttachmentOption((option) =>
			option
				.setName("attachment")
				.setDescription("Attach something to the message")
				.setRequired(false),
		)
		.setDefaultMemberPermissions(
			PermissionFlagsBits.Administrator,
		)
		.setContexts([Guild]),

	async execute(interaction: ChatInputCommandInteraction) {
		const isOwner = immutConfig.ADMINS.has(interaction.user.id);

		if (!isOwner) {
			return interaction.reply({
				content: "You don't have permission to make me talk.",
				flags: [MessageFlags.Ephemeral],
			});
		}

		const text = interaction.options.getString("message");
		const attachment =
			interaction.options.getAttachment("attachment");
		const { channel } = interaction;

		if (!channel || !isGuildTextBased(channel)) {
			return interaction.reply({
				content: "I cant speak here.",
				flags: [MessageFlags.Ephemeral],
			});
		}

		if (!text) {
			return interaction.reply({
				content: "Couldn't find your inputs.",
				flags: [MessageFlags.Ephemeral],
			});
		}

		await channel.send({
			content: text,
			...(attachment && { files: [attachment] }),
		});

		return interaction.reply({
			content: "Message sent.",
			flags: [MessageFlags.Ephemeral],
		});
	},
};

export default sayCommand;
