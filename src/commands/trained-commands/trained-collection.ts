import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
	EmbedBuilder,
	MessageFlags,
	SlashCommandSubcommandBuilder,
} from "discord.js";
import type { FlattenMaps, Require_id } from "mongoose";
import { TrainedHorses, type ITrainedHorses } from "../../lib/models.js";
import rawHorseValues from "../../data/horses.json" with { type: "json" };
import { castAsHorseData } from "../../type-utils.js";
import { immutConfig } from "../../lib/config.js";

const HORSE_VALUES = castAsHorseData(rawHorseValues);
const DEFAULT_HORSE_IMAGE = "https://media.tenor.com/pHsc-VB8NccAAAAj/horse-horses.gif";
const HORSES_PER_PAGE = 3;

function buildEmbeds(trainedList: Array<Require_id<FlattenMaps<ITrainedHorses>> & { __v: number }>) {
	const trainedListWithInfo = trainedList.map((horse) => {
		const { name: breedName, speed: breedSpeed, ...breedRest } = HORSE_VALUES[horse.breed] ?? { name: horse.breed, speed: horse.speed / (1 + horse.speedModifier) };
		return { ...horse, ...breedRest, breedName, breedSpeed };
	});
	return trainedListWithInfo.map((horse) => new EmbedBuilder()
		.setColor("#5c4603")
		.setThumbnail(horse.thumbnail ?? horse.link ?? DEFAULT_HORSE_IMAGE)
		.setTitle(horse.name)
		.setDescription(horse.breedName ?? "Unknown")
		.addFields(
			{ name: "Speed", value: horse.speed.toString() },
			{ name: "Speed Modifier", value: `${horse.speedModifier > 0 ? "+" : ""}${horse.speedModifier * 100}% (from breed's base speed of ${horse.breedSpeed})` },
			{ name: "XP", value: horse.xp?.toString() ?? "0" },
		)
		.setFooter({ text: "XP will do things and be obtainable from races in the future" })
	);
}

function buildButtons(page: number, totalPages: number) {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`trained_collection_prev_${page - 1}`)
			.setLabel("⬅️")
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(page === 0),
		new ButtonBuilder()
			.setCustomId(`trained_collection_next_${page + 1}`)
			.setLabel("➡️")
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(page === totalPages - 1),
	);
}

export const data = new SlashCommandSubcommandBuilder()
	.setName("collection")
	.setDescription("See your collection of trained horses, or someone else's")
	.addUserOption((option) => 
		option
			.setName("user")
			.setDescription("Which user's collection do you want to view?")
			.setRequired(false))

export async function execute(interaction: ChatInputCommandInteraction) {
	const { id: userId } = interaction.options.getUser("user") ?? interaction.user;
	const collection = await TrainedHorses.find({ ownerId: userId }).lean().exec();
	if (collection.length === 0) {
		return interaction.reply({
			content: "No trained horses were found for the user",
			flags: [MessageFlags.Ephemeral],
		});
	}

	const embeds = buildEmbeds(collection);
	const totalPages = Math.ceil(embeds.length / HORSES_PER_PAGE);
	const getPageEmbeds = (page: number) =>
		embeds.slice(
			page * HORSES_PER_PAGE,
			(page + 1) * HORSES_PER_PAGE,
		);

	const response = await interaction.reply({
		embeds: getPageEmbeds(0),
		components: [buildButtons(0, totalPages)],
	});

	const collector = response.createMessageComponentCollector({
		time: immutConfig.MINUTE_MS,
	});

	collector.on("collect", (buttonInteraction: ButtonInteraction) => {
		void (async () => {
			if (buttonInteraction.user.id !== interaction.user.id) {
				await buttonInteraction.reply({
					content: "Only the command user can use these buttons.",
					flags: [MessageFlags.Ephemeral],
				});
				return;
			}

			const page = Number(buttonInteraction.customId.split("_").at(-1));
			if (!Number.isSafeInteger(page) || page < 0 || page >= totalPages) return;

			await buttonInteraction.update({
				embeds: getPageEmbeds(page),
				components: [buildButtons(page, totalPages)],
			});
		})().catch((error: unknown) => {
			console.error("Trained collection pagination failed:", error);
		});
	});
}
