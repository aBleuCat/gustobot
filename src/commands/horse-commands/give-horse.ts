import {
	SlashCommandSubcommandBuilder,
	MessageFlags,
	type ChatInputCommandInteraction,
	type AutocompleteInteraction,
} from "discord.js";
import rawHorseValues from "../../data/horses.json" with { type: "json" };
import {
	conditionHorse,
	horseName,
} from "../../lib/helpers/horse-funcs.js";
import { UserHorses } from "../../lib/models.js";
import { castAsHorseData } from "../../type-utils.js";
import logToModChannel from "../../lib/helpers/mod-log.js";
import { handleCommandError } from "../../lib/helpers/error-handlers.js";
import { recordUserStats } from "../../lib/helpers/user-stats.js";
import { horseItemValue } from "../../lib/helpers/horse-leaderboard.js";

const HORSE_VALUES = castAsHorseData(rawHorseValues, 5);

export const data = new SlashCommandSubcommandBuilder()
	.setName("give")
	.setDescription("Give one of your horses to another user.")
	.addUserOption((option) =>
		option
			.setName("target")
			.setDescription("The user you want to give the horse to")
			.setRequired(true),
	)
	.addStringOption((option) =>
		option
			.setName("horse")
			.setDescription("The horse you want to give")
			.setRequired(true)
			.setAutocomplete(true),
	)
	.addIntegerOption((option) =>
		option
			.setName("amount")
			.setDescription("How many of this horse to give")
			.setMinValue(1),
	);

export async function autocomplete(
	interaction: AutocompleteInteraction,
) {
	const focused = interaction.options.getFocused().toLowerCase();
	const inventory = await UserHorses.findOne({
		userId: interaction.user.id,
	});

	const choices = [];
	if (inventory?.horses) {
		for (const [slug, count] of inventory.horses) {
			if (count > 0 && Object.hasOwn(HORSE_VALUES, slug)) {
				choices.push({
					name: `${horseName(slug)} (x${count})`,
					value: slug,
				});
			}
		}
	}

	const filtered = choices
		.filter((c) => c.name.toLowerCase().includes(focused))
		.slice(0, 25);

	await interaction.respond(filtered);
}

export async function execute(
	interaction: ChatInputCommandInteraction,
) {
	const targetUser = interaction.options.getUser("target");
	const horseSlug = interaction.options.getString("horse");

	if (!targetUser || !horseSlug) {
		return interaction.reply({
			content:
				"try again, something went wrong when trying to recieve your inputs",
			flags: [MessageFlags.Ephemeral],
		});
	}

	if (!interaction.guild) {
		return interaction.reply({
			content:
				"lo siento something went wrong when finding your server",
			flags: [MessageFlags.Ephemeral],
		});
	}

	const botId = interaction.client.user.id;
	const amount = interaction.options.getInteger("amount") ?? 1;

	if (targetUser.id === interaction.user.id) {
		return interaction.reply({
			content: "You can't give a horse to yourself, duh.",
			flags: [MessageFlags.Ephemeral],
		});
	}

	if (targetUser.bot && targetUser.id !== botId) {
		return interaction.reply({
			content: "Bots can't own horses! I think",
			flags: [MessageFlags.Ephemeral],
		});
	}

	if (!Object.hasOwn(HORSE_VALUES, horseSlug)) {
		return interaction.reply({
			content: "That horse doesn't exist.",
			flags: [MessageFlags.Ephemeral],
		});
	}

	const giverInv = await UserHorses.findOne({
		userId: interaction.user.id,
	});
	const owned = giverInv?.horses.get(horseSlug) ?? 0;
	if (!giverInv || owned < amount) {
		return interaction.reply({
			content: `You only have **${owned}** ${horseName(horseSlug)}${owned === 1 ? "" : "s"}, but you tried to give **${amount}**.`,
			flags: [MessageFlags.Ephemeral],
		});
	}

	let receiverInv = await UserHorses.findOne({
		userId: targetUser.id,
	});
	receiverInv ??= new UserHorses({
		userId: targetUser.id,
		horses: new Map(),
	});

	giverInv.horses.set(horseSlug, owned - amount);
	receiverInv.horses.set(
		horseSlug,
		(receiverInv.horses.get(horseSlug) ?? 0) + amount,
	);
	await giverInv.save();
	await receiverInv.save();
	const donatedValue = horseItemValue(horseSlug) * amount;
	await Promise.all([
		recordUserStats(giverInv.userId, {
			increments: {
				"donations.totalGiven": donatedValue,
				"donations.horsesGiven": amount,
				"donations.totalHorseValueGiven": donatedValue,
			},
			maxima: { "donations.highestGiven": donatedValue },
		}),
		recordUserStats(receiverInv.userId, {
			increments: {
				"donations.totalRecieved": donatedValue,
				"donations.horsesRecieved": amount,
				"donations.totalHorseValueRecieved": donatedValue,
			},
			maxima: {
				"donations.highestRecieved": donatedValue,
			},
		}),
	]);

	const horseDisplay = horseName(horseSlug);
	const horseCount = `${amount} ${horseDisplay}${amount === 1 ? "" : "s"}`;
	const message =
		targetUser.id === botId
			? `You offered **${horseCount}** to me! Nom nom nom.`
			: `You gave **${horseCount}** to <@${targetUser.id}>!`;
	await interaction.reply({ content: message });

	logToModChannel(
		interaction.guild,
		`${interaction.user.tag} gave ${horseCount} to ${targetUser.tag}`,
	).catch(async (error: unknown) =>
		handleCommandError(error, interaction),
	);

	await conditionHorse(receiverInv, { interaction });
}
