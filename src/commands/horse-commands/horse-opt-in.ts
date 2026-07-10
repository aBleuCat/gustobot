import {
	type ChatInputCommandInteraction,
	SlashCommandSubcommandBuilder,
	MessageFlags,
} from "discord.js";
import { UserHorses } from "../../lib/models.js";

export const data = new SlashCommandSubcommandBuilder()
	.setName("optin")
	.setDescription("Opt-in or out to horse spawns for every message")
	.addBooleanOption((option) =>
		option
			.setName("in")
			.setDescription("True = opt in; false = opt out")
			.setRequired(false),
	);

export async function execute(
	interaction: ChatInputCommandInteraction,
) {
	const isOptIn = interaction.options.getBoolean("in") ?? true;
	await UserHorses.updateOne(
		{ userId: interaction.user.id },
		{ $set: { optIn: isOptIn } },
		{ upsert: true },
	);
	return interaction.reply({
		content: `You have been opted ${isOptIn ? "in" : "out"}`,
		flags: [MessageFlags.Ephemeral],
	});
}
