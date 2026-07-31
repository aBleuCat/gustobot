import {
	SlashCommandBuilder,
	MessageFlags,
	type ChatInputCommandInteraction,
	type AutocompleteInteraction,
} from "discord.js";
import rawHorseValues from "../data/horses.json" with { type: "json" };
import { UserHorses } from "../lib/models.js";
import { castAsHorseData } from "../type-utils.js";
import { immutConfig } from "../lib/config.js";

const HORSE_VALUES = castAsHorseData(rawHorseValues, 5);

const horseRemovalCommand = {
	data: new SlashCommandBuilder()
		.setName("removehorse")
		.setDescription(
			"Owner Only: Remove a horse or creature from a user",
		)
		.addUserOption((option) =>
			option
				.setName("target")
				.setDescription("The user to remove from")
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("type")
				.setDescription("The type of horse to remove")
				.setRequired(true)
				.setAutocomplete(true),
		)
		.addIntegerOption((option) =>
			option
				.setName("amount")
				.setDescription("How many to remove")
				.setRequired(false)
				.setMinValue(1),
		)
		.addBooleanOption((option) =>
			option
				.setName("ephemeral")
				.setDescription(
					"Shall everyone see the removal message?",
				)
				.setRequired(false),
		),

	async autocomplete(interaction: AutocompleteInteraction) {
		const focusedValue = interaction.options
			.getFocused()
			.toLowerCase();

		// Filter horses based on the input
		const choices = Object.entries(HORSE_VALUES)
			.filter(
				([slug, data]) =>
					data.name.toLowerCase().includes(focusedValue) ||
					slug.toLowerCase().includes(focusedValue),
			)
			.map(([slug, data]) => ({
				name: data.name,
				value: slug,
			}));

		// Discord limits autocomplete to 25 results
		await interaction
			.respond(choices.slice(0, 25))
			.catch(() => undefined);
	},

	async execute(interaction: ChatInputCommandInteraction) {
		if (!immutConfig.ADMINS.has(interaction.user.id)) {
			return interaction.reply({
				content:
					"You are not authorized to use this command.",
				flags: [MessageFlags.Ephemeral],
			});
		}

		const target = interaction.options.getUser("target");
		const type = interaction.options.getString("type");
		const amount = interaction.options.getInteger("amount") ?? 1;
		const isEphemeral =
			interaction.options.getBoolean("ephemeral") ?? true;
		if (!target || !type) {
			return interaction.reply(
				"Something went wrong when trying to get your input",
			);
		}

		// Verify the horse type exists in data
		const horseData = HORSE_VALUES[type];
		if (!horseData) {
			return interaction.reply({
				content: "Invalid horse type selected.",
				flags: [MessageFlags.Ephemeral],
			});
		}

		await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

		const inventory = await UserHorses.findOne({
			userId: target.id,
		});
		if (!inventory) {
			return interaction.editReply(
				`No inventory found for <@${target.id}>.`,
			);
		}

		const currentCount = inventory.horses.get(type) ?? 0;
		if (currentCount === 0) {
			const horseDisplay = horseData.name;
			return interaction.editReply(
				`${horseDisplay} not found in <@${target.id}>'s inventory.`,
			);
		}

		const removed = Math.min(amount, currentCount);
		const newAmount = currentCount - removed;

		if (newAmount === 0) {
			inventory.horses.delete(type);
		} else {
			inventory.horses.set(type, newAmount);
		}

		inventory.markModified("horses");
		await inventory.save();

		const horseDisplay = horseData.name;
		await interaction.editReply(
			`Removed **${removed}x ${horseDisplay}** from <@${target.id}>.`,
		);
		await interaction.followUp({
			content: `<@${target.id}> has had **${removed}x ${horseDisplay}** taken away.`,
			flags: isEphemeral ? [MessageFlags.Ephemeral] : [],
		});
	},
};

export default horseRemovalCommand;
