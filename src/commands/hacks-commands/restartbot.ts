import { spawn } from "node:child_process";
import process from "node:process";
import {
	SlashCommandSubcommandBuilder,
	MessageFlags,
	type ChatInputCommandInteraction,
} from "discord.js";

export const data = new SlashCommandSubcommandBuilder()
	.setName("restartbot")
	.setDescription("Restart the bot");

export async function execute(interaction: ChatInputCommandInteraction) {
	spawn(process.execPath, process.argv.slice(1), {
		detached: true,
		stdio: "ignore",
		windowsHide: true,
	}).unref();

	await interaction.reply({
		content: "Restarting...",
		flags: [MessageFlags.Ephemeral],
	});
	// eslint-disable-next-line unicorn/no-process-exit
	process.exit(0);
}
