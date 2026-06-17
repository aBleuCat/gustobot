import {
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
	MessageFlags,
} from "discord.js";
import { UserHorses } from "../lib/models.js";
import rawHorseValues from "../data/horses.json" with { type: "json" };
import { horseName } from "../lib/helpers/horse-funcs.js";
import { castAsHorseData } from "../type-utils.js";
import { immutConfig } from "../lib/config.js";

const HORSE_VALUES = castAsHorseData(rawHorseValues);

const horseChoices = Object.keys(HORSE_VALUES).map((slug) => ({
	name: horseName(slug),
	value: slug,
}));

const replaceHorsesCommand = {
	data: new SlashCommandBuilder()
		.setName("replacehorses")
		.setDescription(
			"Replace everyone's horse of one type with another (owner only)",
		)
		.addStringOption((option) =>
			option
				.setName("horse")
				.setDescription("The horse to replace")
				.setRequired(true)
				.addChoices(...horseChoices.slice(0, 25)),
		)
		.addStringOption((option) =>
			option
				.setName("replacement")
				.setDescription("The horse to replace it with")
				.setRequired(true)
				.addChoices(...horseChoices.slice(0, 25)),
		),

	async execute(interaction: ChatInputCommandInteraction) {
		if (!immutConfig.ADMINS.has(interaction.user.id)) {
			return interaction.reply({
				content: "no can do",
				flags: [MessageFlags.Ephemeral],
			});
		}

		const horseSlug = interaction.options.getString("horse");
		const replacementSlug =
			interaction.options.getString("replacement");

		if (!horseSlug || !replacementSlug) {
			return interaction.reply({
				content:
					"Something went wrong and we couldnt get ur response",
				flags: [MessageFlags.Ephemeral],
			});
		}

		await interaction.deferReply({
			flags: [MessageFlags.Ephemeral],
		});

		const targetUsers = await UserHorses.find({
			[`horses.${horseSlug}`]: { $gt: 0 },
		});

		if (targetUsers.length === 0) {
			return interaction.editReply(
				`No users found owning **${horseName(horseSlug)}**.`,
			);
		}

		let totalReplaced = 0;
		for (const user of targetUsers) {
			totalReplaced += user.horses.get(horseSlug) ?? 0;
		}

		await UserHorses.updateMany(
			{ [`horses.${horseSlug}`]: { $gt: 0 } },
			[
				{
					$set: {
						[`horses.${replacementSlug}`]: {
							$add: [
								{
									$ifNull: [
										`$horses.${replacementSlug}`,
										0,
									],
								},
								`$horses.${horseSlug}`,
							],
						},
						[`horses.${horseSlug}`]: 0,
					},
				},
			],
		);

		return interaction.editReply(
			`Replaced **${totalReplaced}x ${horseName(horseSlug)}** with **${horseName(replacementSlug)}** across **${targetUsers.length}** user(s).`,
		);
	},
};

export default replaceHorsesCommand;
