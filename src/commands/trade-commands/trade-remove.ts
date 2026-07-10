import {
	type AutocompleteInteraction,
	type ChatInputCommandInteraction,
	MessageFlags,
	SlashCommandSubcommandBuilder,
} from "discord.js";
import { tradeMain } from "../lib/trade-helpers.js";
import { horseName } from "../../lib/helpers/horse-funcs.js";

export const data = new SlashCommandSubcommandBuilder()
	.setName("remove")
	.setDescription("Remove coins or horses from your trade offer")
	.addStringOption((option) =>
		option
			.setName("item")
			.setDescription(
				'The horse name, or "coin" for horse coin',
			)
			.setAutocomplete(true)
			.setRequired(true),
	)
	.addIntegerOption((option) =>
		option
			.setName("amount")
			.setDescription("How many to remove")
			.setMinValue(1)
			.setRequired(true),
	);

export async function autocomplete(
	interaction: AutocompleteInteraction,
) {
	const focused = interaction.options.getFocused().toLowerCase();
	const { channel } = interaction;
	if (!channel) return interaction.respond([]);

	const trade = tradeMain.get(channel.id);
	if (!trade) return interaction.respond([]);

	const color = trade.colorOf(interaction.user.id);
	if (!color) return interaction.respond([]);

	const member = color === "red" ? trade.red : trade.blue;
	const choices: Array<{ name: string; value: string }> = [];

	if (member.coinsOffered > 0 && "coin".includes(focused))
		choices.push({
			name: `Coin (${member.coinsOffered} offered)`,
			value: "coin",
		});

	for (const [slug, amount] of Object.entries(
		member.horsesOffered,
	)) {
		if (amount <= 0) continue;
		const name = horseName(slug) ?? slug;
		const matches =
			slug.includes(focused) ||
			name.toLowerCase().includes(focused);
		if (!matches) continue;

		choices.push({
			name: `${name} (${amount} offered)`,
			value: slug,
		});
	}

	return interaction.respond(choices.slice(0, 25));
}

export async function execute(
	interaction: ChatInputCommandInteraction,
) {
	const { channel } = interaction;
	if (!channel)
		return interaction.reply({
			content: "dasdfasdfasdfasdf idk your channel",
			flags: [MessageFlags.Ephemeral],
		});

	const trade = tradeMain.get(channel.id);
	if (!trade)
		return interaction.reply({
			content: "There's no active trade in this channel",
			flags: [MessageFlags.Ephemeral],
		});

	const color = trade.colorOf(interaction.user.id);
	if (!color)
		return interaction.reply({
			content: "You're not part of this trade",
			flags: [MessageFlags.Ephemeral],
		});

	const item = interaction.options
		.getString("item", true)
		.toLowerCase();
	const amount = interaction.options.getInteger("amount", true);

	try {
		trade.remove(color, item, amount);
	} catch (error) {
		return interaction.reply({
			content:
				error instanceof Error
					? error.message
					: "Something went wrong removing that",
			flags: [MessageFlags.Ephemeral],
		});
	}

	return interaction.reply({
		content: `Removed ${amount} ${horseName(item)} from your offer`,
		flags: [MessageFlags.Ephemeral],
	});
}
