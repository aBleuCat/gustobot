import {
	SlashCommandSubcommandBuilder,
	MessageFlags,
	type ChatInputCommandInteraction,
} from "discord.js";
import {
	config,
	isConfigListKey,
	isListAction,
} from "./shared.js";

export const data = new SlashCommandSubcommandBuilder()
	.setName("lists")
	.setDescription("Manage whitelists and blacklists")
	.addStringOption((option) =>
		option
			.setName("listname")
			.setDescription("Which list to modify")
			.setRequired(true)
			.addChoices(
				{
					name: "Primary Whitelist",
					value: "primaryTrigWhitelist",
				},
				{
					name: "Primary Blacklist",
					value: "primaryTrigBlacklist",
				},
				{
					name: "Secondary Whitelist",
					value: "secondaryTrigWhitelist",
				},
				{
					name: "Secondary Blacklist",
					value: "secondaryTrigBlacklist",
				},
			),
	)
	.addStringOption((option) =>
		option
			.setName("action")
			.setDescription("Add or remove an ID")
			.setRequired(true)
			.addChoices(
				{ name: "add", value: "add" },
				{ name: "remove", value: "remove" },
				{ name: "view", value: "view" },
			),
	)
	.addStringOption((option) =>
		option
			.setName("id")
			.setDescription("The User/Bot ID to add or remove")
			.setRequired(false),
	);

export async function execute(interaction: ChatInputCommandInteraction) {
	const listName = interaction.options.getString("listname", true);
	const action = interaction.options.getString("action", true);
	const targetId = interaction.options.getString("id");

	if (!isConfigListKey(listName) || !isListAction(action)) {
		await interaction.reply({
			content: "Invalid list command options provided.",
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	config.lists[listName] ??= [];

	if (action === "view") {
		const listString =
			config.lists[listName].length > 0
				? config.lists[listName].join(", ")
				: "Empty";
		await interaction.reply({
			content: `**${listName}**: ${listString}`,
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	if (!targetId) {
		await interaction.reply({
			content: "ID required for this action.",
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	if (action === "add" && !config.lists[listName].includes(targetId)) {
		config.lists[listName].push(targetId);
		await interaction.reply({
			content: `Added \`${targetId}\` to ${listName}`,
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	if (action === "remove") {
		config.lists[listName] = config.lists[listName].filter(
			(id) => id !== targetId,
		);
		await interaction.reply({
			content: `Removed \`${targetId}\` from ${listName}`,
			flags: [MessageFlags.Ephemeral],
		});
	}
}
