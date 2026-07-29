import {
	ActionRowBuilder,
	type AutocompleteInteraction,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	type ChatInputCommandInteraction,
	EmbedBuilder,
	MessageFlags,
	SlashCommandSubcommandBuilder,
} from "discord.js";
import {
	UserHorses,
	TrainedHorses,
	type ITrainedHorsesProps,
} from "../../lib/models.js";
import rawHorseValues from "../../data/horses.json" with { type: "json" };
import { castAsHorseData } from "../../type-utils.js";
import { horseName } from "../../lib/helpers/horse-funcs.js";
import { config, immutConfig } from "../../lib/config.js";

const HORSE_VALUES = castAsHorseData(rawHorseValues);
const escapeRegex = (input: string) =>
	input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const { TRAINING_PRICE_CONSTANT, TRAINING_PRICE_DIVISOR } = config;
const TRAINING_DURATION_BEFORE_EXPIRATION = 2 * immutConfig.MINUTE_MS;

export const data = new SlashCommandSubcommandBuilder()
	.setName("train")
	.setDescription("Train a horse for use in horse racing")
	.addStringOption((option) =>
		option
			.setName("horse")
			.setDescription("the type of horse you want to train")
			.setRequired(true)
			.setAutocomplete(true),
	)
	.addStringOption((option) =>
		option
			.setName("name")
			.setDescription(
				"What do you want to name your trained horsy?",
			)
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
	const name = interaction.options.getString("name");
	const userInventory = await UserHorses.findOne({
		userId: interaction.user.id,
	})
		.select("horseCoins")
		.lean();

	const userCoins = userInventory?.horseCoins;
	if (!horseSlug || !name)
		return interaction.reply({
			content:
				"Something went wrong when recieving your inputs",
			flags: [MessageFlags.Ephemeral],
		});
	// Captured into fresh consts so the narrowed (non-null) type
	// survives being read inside the nested handleTrainAcceptance
	// closure below, since TS narrowing doesn't cross function boundaries.
	const trainedHorseSlug = horseSlug;
	const trainedHorseName = name;
	const horseObject = HORSE_VALUES[horseSlug];
	if (!horseObject)
		return interaction.reply({
			content: "That horse doesn't seem to exist",
			flags: [MessageFlags.Ephemeral],
		});
	if (userCoins === undefined || userCoins === null)
		return interaction.reply({
			content:
				"Could not find your inventory, or your inventory has been lobotomized",
			flags: [MessageFlags.Ephemeral],
		});

	const escapedName = escapeRegex(name);
	const existingHorse = await TrainedHorses.findOne({
		ownerId: interaction.user.id,
		name: { $regex: new RegExp(`^${escapedName}$`, "iv") },
	});

	if (existingHorse) {
		return interaction.reply({
			content: `You already have a trained horse named **${name}**. Please choose a unique name!`,
			flags: [MessageFlags.Ephemeral],
		});
	}

	const { value, speed } = horseObject;

	const price =
		Math.floor(value / TRAINING_PRICE_DIVISOR) +
		TRAINING_PRICE_CONSTANT;
	if (userCoins < price)
		return interaction.reply({
			content: `You do not have enough moneys to pay for the cost of training this horse\nIt costs ${price}, but you only have ${userCoins}`,
			flags: [MessageFlags.Ephemeral],
		});
	const speedModifier = Number(
		(Math.random() * 0.2 - 0.1).toFixed(2),
	); // Generate number betwen 0.1 and -0.1
	const totalSpeed = speed + speed * speedModifier;

	const payForTrainingButtonRow =
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(`train_pay_${price}`)
				.setLabel("Pay")
				.setStyle(ButtonStyle.Success),
			new ButtonBuilder()
				.setCustomId("train_pay_reject")
				.setLabel("Cancel")
				.setStyle(ButtonStyle.Danger),
		);
	const response = await interaction.reply({
		content: `This will cost ${price} horse coin${price === 1 ? "" : "s"}. You have ${userCoins}. The horse's speed will be around ${speed}. Click button to confirm`,
		components: [payForTrainingButtonRow],
	});
	const collector = response.createMessageComponentCollector({
		time: TRAINING_DURATION_BEFORE_EXPIRATION,
	});
	const embed = new EmbedBuilder()
		.setColor("#954535") // Chestnut
		.setTitle("Trained Horse")
		.setDescription("Your horse has been successfully trained")
		.addFields(
			{ name: "Name", value: name },
			{ name: "Breed", value: horseName(horseSlug) },
			{
				name: "Speed Stat",
				value: `\`${speedModifier > 0 ? "+" : ""}${Math.round(speedModifier * 100)}%\``,
			},
			{ name: "Speed", value: String(totalSpeed) },
		);
	collector.on(
		"collect",
		(buttonInteraction: ButtonInteraction) => {
			(async (buttonInteraction: ButtonInteraction) => {
				try {
					await handleTrainAcceptance(buttonInteraction);
				} catch (error) {
					console.error(
						"/horse train collector error:",
						error,
					);
					await buttonInteraction
						.reply({
							content:
								"Something went wrong finishing the training, sorry!",
							flags: [MessageFlags.Ephemeral],
						})
						.catch(() => undefined);
				}
			})(buttonInteraction);
		},
	);

	collector.on("end", (_, reason) => {
		if (reason === "time") {
			void response
				.edit({
					content: "Training offer expired.",
					components: [],
				})
				.catch(() => undefined);
		}
	});

	async function handleTrainAcceptance(
		buttonInteraction: ButtonInteraction,
	) {
		if (buttonInteraction.user.id !== interaction.user.id)
			return buttonInteraction.reply({
				content: `What are you trynna do? Only <@${interaction.user.id}> can confirm this`,
				flags: [MessageFlags.Ephemeral],
			});
		if (buttonInteraction.customId === "train_pay_reject") {
			collector.stop("cancelled");
			return buttonInteraction.update({
				content: "Training cancelled :(",
				components: [],
			});
		}

		const secondNameDupeCheck = await TrainedHorses.findOne({
			ownerId: interaction.user.id,
			name: {
				$regex: new RegExp(`^${escapedName}$`, "iv"),
			},
		});

		if (secondNameDupeCheck) {
			collector.stop("rejected_duplicate_name");

			return buttonInteraction.update({
				content: `Transaction failed. You managed to create a horse named **${name}** while this prompt was open.`,
				components: [],
			});
		}

		collector.stop("accepted");
		/* Deduct because trained horses are not normal horses,
		and normal actions should not be applicable to trained horses
		because normal actions are not designed to
		E.g., /horses give only interacts with UserHorses
		and not with TrainedHorses, creating a dupe bug */
		const updateResult = await UserHorses.updateOne(
			{
				userId: interaction.user.id,
				// Check that they have enough coins RIGHT NOW
				horseCoins: { $gte: price },
				// Check that they still have at least 1 of this horse type
				[`horses.${horseSlug}`]: { $gt: 0 },
			},
			{
				$inc: {
					[`horses.${horseSlug}`]: -1,
					horseCoins: -price,
				},
			},
		);

		// If no documents matched, it means they spent their coins or gave away horse
		if (updateResult.matchedCount === 0) {
			return buttonInteraction.reply({
				content:
					"Transaction failed! You no longer have enough coins or the required horse.",
				flags: [MessageFlags.Ephemeral],
			});
		}

		const trainedHorse: ITrainedHorsesProps = {
			ownerId: interaction.user.id,
			name: trainedHorseName,
			breed: trainedHorseSlug,
			speed: totalSpeed,
			speedModifier,
		};

		await TrainedHorses.create(trainedHorse);
		return buttonInteraction.update({
			embeds: [embed],
			components: [],
		});
	}
}
