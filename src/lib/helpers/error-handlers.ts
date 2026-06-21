import {
	MessageFlags,
	type ChatInputCommandInteraction,
} from "discord.js";
import devLog from "./dev-log.js";
// Error logging func for commands
export async function handleCommandError(
	error: unknown,
	interaction: ChatInputCommandInteraction,
) {
	const errorMessage =
		error instanceof Error
			? error.message
			: "error message could not be found";

	console.error(error);

	devLog(
		`Error executing /${interaction.commandName}: ${errorMessage}`,
	).catch((error: unknown) => {
		console.error(error);
	});

	// No flags allowed in edit reply
	if (interaction.replied || interaction.deferred) {
		await interaction
			.editReply({
				content: `Error: ${errorMessage}`,
			})
			.catch(() => undefined);
		return;
	}

	await interaction
		.reply({
			content: `Error: ${errorMessage}`,
			flags: [MessageFlags.Ephemeral],
		})
		.catch(() => undefined);
}
