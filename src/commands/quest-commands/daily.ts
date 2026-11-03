import {
	SlashCommandSubcommandBuilder,
	type ChatInputCommandInteraction,
} from "discord.js";
import { executeQuestCommand } from "../lib/quest-command-helper.js";

export const data = new SlashCommandSubcommandBuilder()
	.setName("daily")
	.setDescription("View and claim your daily quests")
	.addBooleanOption((option) =>
		option
			.setName("autoclaim")
			.setDescription(
				"Disable automatic claiming for this request",
			),
	);

export async function execute(
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	await executeQuestCommand(interaction, "daily");
}
