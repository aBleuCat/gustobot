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
		for (const [slug, count] of inventory.horses.entries()) {
			if (count > 0 && HORSE_VALUES[slug]) {
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
	const botId = interaction.client.user.id;
	if (!targetUser || !horseSlug)
		return interaction.reply({
			content:
				"try again, something went wrong when trying to recieve your inputs",
			flags: [MessageFlags.Ephemeral],
		});
	if (!interaction.guild)
		return interaction.reply({
			content:
				"lo siento something went wrong when finding your server",
			flags: [MessageFlags.Ephemeral],
		});

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

	const giverInv = await UserHorses.findOne({
		userId: interaction.user.id,
	});
	if (!giverInv || (giverInv.horses.get(horseSlug) ?? 0) <= 0) {
		return interaction.reply({
			content: `You don't have a **${horseName(horseSlug)}**!`,
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

	giverInv.horses.set(
		horseSlug,
		(giverInv.horses.get(horseSlug) ?? 0) - 1,
	);
	receiverInv.horses.set(
		horseSlug,
		(receiverInv.horses.get(horseSlug) ?? 0) + 1,
	);
	await giverInv.save();
	await receiverInv.save();

	const horseDisplay = horseName(horseSlug);
	const message =
		targetUser.id === botId
			? `You offered a **${horseDisplay}** to me! Nom nom nom.`
			: `You gave your **${horseDisplay}** to <@${targetUser.id}>!`;
	await interaction.reply({ content: message });

	logToModChannel(
		interaction.guild,
		`${interaction.user.tag} gave a ${horseDisplay} to ${targetUser.tag}`,
	).catch(async (error: unknown) =>
		handleCommandError(error, interaction),
	);

	await conditionHorse(receiverInv, { interaction });
}
