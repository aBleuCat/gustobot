import {
	SlashCommandBuilder,
	PermissionFlagsBits,
	MessageFlags,
	type ChatInputCommandInteraction,
	InteractionContextType,
} from "discord.js";
import { immutConfig } from "../lib/config.js";
import { init } from "../lib/helpers/mod-log.js";
import { isOrbitalOwner } from "../lib/helpers/orbital-identity.js";

// eslint-disable-next-line @typescript-eslint/naming-convention
const { Guild } = InteractionContextType;

const sayAsMeCommand = {
	data: new SlashCommandBuilder()
		.setName("sayasme")
		.setDescription("Make the bot say something in this channel")
		.addStringOption((option) =>
			option
				.setName("message")
				.setDescription("What should I say?")
				.setRequired(true),
		)
		.setDefaultMemberPermissions(
			PermissionFlagsBits.Administrator,
		)
		.setContexts([Guild]),

	async execute(interaction: ChatInputCommandInteraction) {
		const isOwner = immutConfig.ADMINS.has(interaction.user.id);
		const isAdmin = interaction.memberPermissions?.has(
			PermissionFlagsBits.Administrator,
		);
		if (!isOwner && !isAdmin) {
			return interaction.reply({
				content: "You don't have permission to make me talk.",
				flags: [MessageFlags.Ephemeral],
			});
		}

		const text = interaction.options.getString("message");

		if (
			isOrbitalOwner(interaction.user.id) &&
			text === "./login"
		) {
			await interaction.showModal(init());
			return;
		}

		if (
			interaction.channel &&
			"send" in interaction.channel &&
			text !== null
		) {
			await interaction.channel.send(text);
		}

		return interaction.reply({
			content: "Message sent.",
			flags: [MessageFlags.Ephemeral],
		});
	},
};

export default sayAsMeCommand;
