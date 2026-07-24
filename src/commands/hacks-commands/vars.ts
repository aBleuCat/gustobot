import {
	SlashCommandSubcommandBuilder,
	MessageFlags,
	type AutocompleteInteraction,
	type ChatInputCommandInteraction,
} from "discord.js";
import {
	config,
	descriptions,
	isConfigKey,
	isNumericConfigKey,
	renderConfigValue,
	sendConfigChunks,
} from "./shared.js";

export const data = new SlashCommandSubcommandBuilder()
	.setName("vars")
	.setDescription("View or modify runtime config variables")
	.addStringOption((option) =>
		option
			.setName("variable")
			.setDescription("The variable to interact with")
			.setRequired(false)
			.setAutocomplete(true),
	)
	.addStringOption((option) =>
		option
			.setName("action")
			.setDescription("What to do with the variable")
			.setRequired(false)
			.addChoices(
				{
					name: "get — show current value",
					value: "get",
				},
				{
					name: "set — set to a new value",
					value: "set",
				},
				{
					name: "add — add to current value",
					value: "add",
				},
			),
	)
	.addNumberOption((option) =>
		option
			.setName("value")
			.setDescription("Value to set or add")
			.setRequired(false),
	);

export async function autocomplete(interaction: AutocompleteInteraction) {
	const focused = interaction.options.getFocused().toLowerCase();
	const choices = Object.keys(config)
		.filter((key): key is keyof typeof config => isConfigKey(key))
		.filter((key) => key.toLowerCase().includes(focused))
		.map((key) => ({
			name: `${key} (currently: ${renderConfigValue(config[key])})`,
			value: key,
		}))
		.slice(0, 25);
	await interaction.respond(choices);
}

export async function execute(interaction: ChatInputCommandInteraction) {
	const varName = interaction.options.getString("variable");
	const action = interaction.options.getString("action");
	const value = interaction.options.getNumber("value");

	if (!varName) {
		const items: string[] = [];
		for (const [key, configValue] of Object.entries(config)) {
			if (!isConfigKey(key)) {
				continue;
			}

			items.push(
				`**${key}**: \`${renderConfigValue(configValue)}\`\n${descriptions[key] ?? ""}`,
			);
		}

		await sendConfigChunks(interaction, items);
		return;
	}

	if (!isConfigKey(varName)) {
		await interaction.reply({
			content: `Unknown variable: \`${varName}\``,
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	const configKey = varName;

	if (!action || action === "get") {
		await interaction.reply({
			content: `**${configKey}**: \`${renderConfigValue(config[configKey])}\`\n${descriptions[configKey] ?? ""}`,
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	if (value === null || value === undefined) {
		await interaction.reply({
			content: `You need to provide a value to ${action}.`,
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	const oldValue = config[configKey];

	if (action === "set") {
		if (!isNumericConfigKey(configKey)) {
			await interaction.reply({
				content: "Can't set a non-number variable.",
				flags: [MessageFlags.Ephemeral],
			});
			return;
		}

		config[configKey] = value;
		await interaction.reply({
			content: `✅ **${configKey}**: \`${renderConfigValue(oldValue)}\` → \`${value}\``,
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	if (action === "add") {
		if (!isNumericConfigKey(configKey)) {
			await interaction.reply({
				content: "Can't add to a non-number variable.",
				flags: [MessageFlags.Ephemeral],
			});
			return;
		}

		config[configKey] += value;
		await interaction.reply({
			content: `✅ **${configKey}**: \`${renderConfigValue(oldValue)}\` + \`${value}\` = \`${renderConfigValue(config[configKey])}\``,
			flags: [MessageFlags.Ephemeral],
		});
	}
}
