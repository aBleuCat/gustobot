import {
	type AutocompleteInteraction,
	type ChatInputCommandInteraction,
	MessageFlags,
	SlashCommandSubcommandBuilder,
} from "discord.js";
import { UserHorses } from "../../lib/models.js";
import rawHorseValues from "../../data/horses.json" with { type: "json" };
import {
	castAsHorseData,
	isGuildTextBased,
} from "../../type-utils.js";
import { horseName } from "../../lib/helpers/horse-funcs.js";
import { createHorseCatch } from "../../lib/helpers/horse-catch-helper.js";

const HORSE_VALUES = castAsHorseData(rawHorseValues);

export const data = new SlashCommandSubcommandBuilder()
	.setName("release")
	.setDescription(
		"Release your horse into the wild for someone to catch",
	)
	.addStringOption((option) =>
		option
			.setName("horse")
			.setDescription("The horse you wish to set free")
			.setAutocomplete(true)
			.setRequired(true),
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
		.filter((choice) =>
			choice.name.toLowerCase().includes(focused),
		)
		.slice(0, 25);

	await interaction.respond(filtered);
}

export async function execute(
	interaction: ChatInputCommandInteraction,
) {
	const horseSlug = interaction.options.getString("horse");
	const horse = horseSlug ? HORSE_VALUES[horseSlug] : undefined;
	const { channel } = interaction;
	if (!channel || !isGuildTextBased(channel)) {
		return interaction.reply({
			content:
				"Failed to find your channel, or the channel is not valid",
			flags: [MessageFlags.Ephemeral],
		});
	}

	if (!horse || !horseSlug) {
		return interaction.reply({
			content:
				"Couldn't find your inputs, or your input was invalid",
			flags: [MessageFlags.Ephemeral],
		});
	}

	await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

	await createHorseCatch(
		channel,
		{ hasJustSpawned: false, releaser: interaction.user.id },
		{ horse: [horseSlug, horse] },
	);

	return interaction.editReply({
		content:
			"Your horse has been released into the wild, probably just to be caught again.",
	});
}
