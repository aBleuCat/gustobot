import {
	type AutocompleteInteraction,
	type ChatInputCommandInteraction,
	MessageFlags,
	SlashCommandSubcommandBuilder,
	EmbedBuilder,
	type InteractionReplyOptions,
} from "discord.js";
import { Types } from "mongoose";
import { TrainedHorses } from "../../lib/models.js";
import { raceMaster } from "../lib/horse-race-challenge.js";

export const data = new SlashCommandSubcommandBuilder()
	.setName("add")
	.setDescription("Select your horse to use for this race")
	.addStringOption((option) =>
		option
			.setName("horse")
			.setDescription("The horse to use for the race")
			.setRequired(true)
			.setAutocomplete(true),
	);

export async function autocomplete(
	interaction: AutocompleteInteraction,
) {
	try {
		const focused = interaction.options
			.getFocused()
			.toLowerCase();
		const horses = await TrainedHorses.find({
			ownerId: interaction.user.id,
		}).lean();

		await interaction.respond(
			horses
				.filter((horse) =>
					horse.name.toLowerCase().includes(focused),
				)
				.slice(0, 25)
				.map((horse) => ({
					name: `${horse.name} (${horse.breed})`,
					value: horse._id.toString(),
				})),
		);
	} catch (error) {
		console.error("/race add autocomplete error:", error);
		try {
			await interaction.respond([]);
		} catch {
			return undefined;
		}
	}
}

export async function execute(
	interaction: ChatInputCommandInteraction,
) {
	const selectedHorseId = interaction.options.getString("horse");
	const { channel } = interaction;
	if (!selectedHorseId) {
		return interaction.reply({
			content: "Failed to get your inputs",
			flags: [MessageFlags.Ephemeral],
		});
	}

	if (!Types.ObjectId.isValid(selectedHorseId)) {
		return interaction.reply({
			content: "Please select a horse from the suggestion list",
			flags: [MessageFlags.Ephemeral],
		});
	}

	if (!channel) {
		return interaction.reply({
			content: "Failed to find your channel",
			flags: [MessageFlags.Ephemeral],
		});
	}

	const race = raceMaster.get(channel.id);
	if (!race) {
		return interaction.reply({
			content: "There is no active race in this channel",
			flags: [MessageFlags.Ephemeral],
		});
	}

	const selectedHorse =
		await TrainedHorses.findById(selectedHorseId).lean();
	if (selectedHorse?.ownerId !== interaction.user.id) {
		return interaction.reply({
			content:
				"Either that horse doesn't exist or doesn't belong to you. Either way, you can't use it.",
			flags: [MessageFlags.Ephemeral],
		});
	}

	const color = race.getColor(interaction.user.id);
	if (!color) {
		return interaction.reply({
			content: "You aren't in the race. Be patient.",
			flags: [MessageFlags.Ephemeral],
		});
	}

	try {
		race.addHorse(color, selectedHorse);
		const embed = new EmbedBuilder().addFields(
			{ name: "Name", value: selectedHorse.name },
			{ name: "Breed", value: selectedHorse.breed || "Unknown" },
			{
				name: "Stats",
				value: `\`${selectedHorse.speedStat}\``,
			},
		);
		const message: InteractionReplyOptions = {
			content:
				"You have selected your horse. Waiting on the other participants.",
			flags: [MessageFlags.Ephemeral],
			embeds: [embed],
		};
		if (!race.isReady) return await interaction.reply(message);
		race.toReady();
		message.content =
			"Everyone has selected their horses. The race will now begin";
		return await interaction.reply(message);
	} catch (error) {
		return interaction.reply({
			content:
				error instanceof Error
					? error.message === "There is already a horse"
						? "You have already selected a horse. If you want to replace it, use `/race remove` first."
						: error.message
					: String(error),
			flags: [MessageFlags.Ephemeral],
		});
	}
}
