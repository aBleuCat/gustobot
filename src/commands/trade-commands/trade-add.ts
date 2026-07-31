import {
	type AutocompleteInteraction,
	type ChatInputCommandInteraction,
	MessageFlags,
	SlashCommandSubcommandBuilder,
} from "discord.js";
import { tradeMain } from "../lib/trade-helpers.js";
import { UserHorses } from "../../lib/models.js";
import { horseName } from "../../lib/helpers/horse-funcs.js";

export const data = new SlashCommandSubcommandBuilder()
	.setName("add")
	.setDescription("Add coins or horses to your trade offer")
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
			.setDescription("How many to add")
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
	const userHorses = await UserHorses.findOne({
		userId: interaction.user.id,
	});

	const choices: Array<{ name: string; value: string }> = [];

	const ownedCoins = userHorses?.horseCoins ?? 0;
	const availableCoins = ownedCoins - member.coinsOffered;
	if (availableCoins > 0 && "coin".includes(focused))
		{choices.push({
			name: `Coin (${availableCoins} available)`,
			value: "coin",
		});}

	if (userHorses) {
		for (const [slug, owned] of userHorses.horses) {
			const name = horseName(slug) ?? slug;
			const isMatches =
				slug.includes(focused) ||
				name.toLowerCase().includes(focused);
			if (!isMatches) continue;

			const available =
				owned - (member.horsesOffered[slug] ?? 0);
			if (available <= 0) continue;

			choices.push({
				name: `${name} (${available} available)`,
				value: slug,
			});
		}
	}

	return interaction.respond(choices.slice(0, 25));
}

export async function execute(
	interaction: ChatInputCommandInteraction,
) {
	const { channel } = interaction;
	if (!channel)
		{return interaction.reply({
			content: "dasdfasdfasdfasdf idk your channel",
			flags: [MessageFlags.Ephemeral],
		});}

	const trade = tradeMain.get(channel.id);
	if (!trade)
		{return interaction.reply({
			content: "There's no active trade in this channel",
			flags: [MessageFlags.Ephemeral],
		});}

	const color = trade.colorOf(interaction.user.id);
	if (!color)
		{return interaction.reply({
			content: "You're not part of this trade",
			flags: [MessageFlags.Ephemeral],
		});}

	const item = interaction.options
		.getString("item", true)
		.toLowerCase();
	const amount = interaction.options.getInteger("amount", true);

	const member = color === "red" ? trade.red : trade.blue;
	const alreadyOffered =
		item === "coin"
			? member.coinsOffered
			: (member.horsesOffered[item] ?? 0);

	const userHorses = await UserHorses.findOne({
		userId: interaction.user.id,
	});
	const available =
		item === "coin"
			? (userHorses?.horseCoins ?? 0)
			: (userHorses?.horses.get(item) ?? 0);

	if (alreadyOffered + amount > available)
		{return interaction.reply({
			content: `You don't have that many ${horseName(item)} available (you have ${available}, already offering ${alreadyOffered}).`,
			flags: [MessageFlags.Ephemeral],
		});}

	try {
		trade.add(color, item, amount);
	} catch (error) {
		return interaction.reply({
			content:
				error instanceof Error
					? error.message
					: "Something went wrong adding that",
			flags: [MessageFlags.Ephemeral],
		});
	}

	return interaction.reply({
		content: `Added ${amount} ${horseName(item)} to your offer`,
		flags: [MessageFlags.Ephemeral],
	});
}
