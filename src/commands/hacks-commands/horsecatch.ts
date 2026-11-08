import {
	SlashCommandSubcommandBuilder,
	MessageFlags,
	type AutocompleteInteraction,
	type ChatInputCommandInteraction,
} from "discord.js";
import rawHorseValues from "../../data/horses.json" with { type: "json" };
import { createHorseCatch } from "../../lib/helpers/horse-catch-helper.js";
import { castAsHorseData } from "../../type-utils.js";

const horses = castAsHorseData(rawHorseValues);

export const data = new SlashCommandSubcommandBuilder()
	.setName("horsecatch")
	.setDescription("Create a horse catch in this channel")
	.addStringOption((option) =>
		option
			.setName("horse")
			.setDescription("The horse to create a catch for")
			.setRequired(true)
			.setAutocomplete(true),
	)
	.addUserOption((option) =>
		option
			.setName("releaser")
			.setDescription("The user who released the horse")
			.setRequired(true),
	);

export async function autocomplete(
	interaction: AutocompleteInteraction,
): Promise<void> {
	const search = interaction.options.getFocused().toLowerCase();
	const choices = Object.entries(horses)
		.filter(
			([slug, horse]) =>
				horse.name.toLowerCase().includes(search) ||
				slug.toLowerCase().includes(search),
		)
		.slice(0, 25)
		.map(([slug, horse]) => ({
			name: horse.name,
			value: slug,
		}));
	await interaction.respond(choices);
}

export async function execute(
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const horseSlug = interaction.options.getString("horse", true);
	const releaser = interaction.options.getUser("releaser", true);
	const horse = horses[horseSlug];

	if (!horse) {
		await interaction.reply({
			content: "That horse does not exist.",
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	if (!interaction.channel) {
		await interaction.reply({
			content:
				"I could not find a channel to create the horse catch in.",
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	await interaction.deferReply({
		flags: [MessageFlags.Ephemeral],
	});
	await createHorseCatch(
		interaction.channel,
		{ hasJustSpawned: false, releaser: releaser.id },
		{ horse: [horseSlug, horse] },
	);
	await interaction.deleteReply();
}
