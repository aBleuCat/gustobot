import {
	SlashCommandSubcommandBuilder,
	type ChatInputCommandInteraction,
	EmbedBuilder,
	MessageFlags,
} from "discord.js";
import { UserHorses } from "../../lib/models.js";
import rawHorseValues from "../../data/horses.json" with { type: "json" };
import { castAsHorseData } from "../../type-utils.js";

const HORSE_VALUES = castAsHorseData(rawHorseValues);

export const data = new SlashCommandSubcommandBuilder()
	.setName("last")
	.setDescription("See the last horse someone found")
	.addUserOption((option) =>
		option
			.setName("user")
			.setDescription("The user to check (defaults to yourself)")
			.setRequired(false),
	);

export async function execute(
	interaction: ChatInputCommandInteraction,
) {
	const targetUser =
		interaction.options.getUser("user") ?? interaction.user;
	const isSelf = targetUser.id === interaction.user.id;

	const inventory = await UserHorses.findOne({
		userId: targetUser.id,
	});
	const lastSlug = inventory?.lastHorse;
	const lastHorseData = lastSlug ? HORSE_VALUES[lastSlug] : undefined;

	if (!lastSlug || !lastHorseData) {
		return interaction.reply({
			content: isSelf
				? "You haven't found any horses yet! Start chatting to find some."
				: `${targetUser.username} hasn't found any horses yet.`,
			flags: [MessageFlags.Ephemeral],
		});
	}

	const embed = new EmbedBuilder()
		.setColor("#954535")
		.setTitle("Last Horse Found")
		.setDescription(
			isSelf
				? `The last horse you found was **${lastHorseData.name}**!`
				: `The last horse ${targetUser.username} found was **${lastHorseData.name}**!`,
		)
		.addFields(
			{ name: "Breed", value: lastHorseData.name, inline: true },
			{
				name: "Value",
				value: `$${lastHorseData.value.toLocaleString()}`,
				inline: true,
			},
			{
				name: "Speed",
				value: String(lastHorseData.speed),
				inline: true,
			},
		)
		.setThumbnail(lastHorseData.link || null);

	return interaction.reply({
		embeds: [embed],
		flags: [MessageFlags.Ephemeral],
	});
}
