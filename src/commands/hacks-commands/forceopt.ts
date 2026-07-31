import { type ChatInputCommandInteraction, MessageFlags, SlashCommandSubcommandBuilder } from "discord.js";
import { UserHorses } from "../../lib/models.js";

export const data = new SlashCommandSubcommandBuilder()
	.setName("forceopt")
	.setDescription("Use admin powers to forcibly opt in/out someone from horse spawning")
	.addUserOption((option) =>
		option
			.setName("target")
			.setDescription("The user to opt in/out")
			.setRequired(true)
	)
	.addBooleanOption((option) =>
		option
			.setName("in")
			.setDescription("True = opt in. False = opt out.")
	)

export async function execute(interaction: ChatInputCommandInteraction) {
	const isOptIn = interaction.options.getBoolean("in") ?? true;
	const target = interaction.options.getUser("target");
	if (!target) {
		return interaction.reply({
			content: `Could not find the user to be opted ${isOptIn ? "in" : "out"}`,
			flags: [MessageFlags.Ephemeral],
		});
	}

	await UserHorses.updateOne(
		{ userId: target.id },
		{ $set: { optIn: isOptIn } },
		{ upsert: true },
	);
	return interaction.reply({
		content: `<@${target.id}> has been opted ${isOptIn ? "in" : "out"}`,
		flags: [MessageFlags.Ephemeral],
	});
}
