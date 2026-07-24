import process from "node:process";
import {
	SlashCommandSubcommandBuilder,
	MessageFlags,
	type ChatInputCommandInteraction,
} from "discord.js";

export const data = new SlashCommandSubcommandBuilder()
	.setName("killbot")
	.setDescription("Shut down the bot");

export async function execute(interaction: ChatInputCommandInteraction) {
	await interaction.reply({
		content: "Shutting down...",
		flags: [MessageFlags.Ephemeral],
	});
	// eslint-disable-next-line unicorn/no-process-exit
	process.exit(0);
}
