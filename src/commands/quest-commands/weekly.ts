import {
	SlashCommandSubcommandBuilder,
	type ChatInputCommandInteraction,
} from "discord.js";
import { executeQuestCommand } from "../lib/quest-command-helper.js";

export const data = new SlashCommandSubcommandBuilder()
	.setName("weekly")
	.setDescription("View and claim your weekly quests")
	.addBooleanOption((option) =>
		option
			.setName("autoclaim")
			.setDescription(
				"Disable automatic claiming for this request",
			),
	)
	.addBooleanOption((option) =>
		option
			.setName("ephemeral")
			.setDescription(
				"Show the quest list only to you (defaults to true)",
			),
	);

export async function execute(
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	await executeQuestCommand(interaction, "weekly");
}
