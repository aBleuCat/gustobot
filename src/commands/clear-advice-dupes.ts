import {
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
	MessageFlags,
} from "discord.js";
import type mongoose from "mongoose";
import { Advice } from "../lib/models.js";
import { immutConfig } from "../lib/config.js";

type DuplicateAggregationResult = {
	_id: { content: string };
	dupes: mongoose.Types.ObjectId[];
	count: number;
};

const clearAdviceDupesCommand = {
	data: new SlashCommandBuilder()
		.setName("clearadvicedupes")
		.setDescription(
			"Cleans the database of duplicate advice entries",
		),
	async execute(interaction: ChatInputCommandInteraction) {
		// Owner Check
		if (!immutConfig.ADMINS.has(interaction.user.id)) {
			return interaction.reply({
				content: "Only the owner can scrub the database.",
				flags: [MessageFlags.Ephemeral],
			});
		}

		await interaction.deferReply({
			flags: [MessageFlags.Ephemeral],
		});

		// Explicitly type the aggregation result using <type[]>
		const duplicates =
			await Advice.aggregate<DuplicateAggregationResult>([
				{
					$group: {
						_id: { content: "$content" },
						dupes: { $push: "$_id" },
						count: { $sum: 1 },
					},
				},
				{ $match: { count: { $gt: 1 } } },
			]);

		// Flatten all target IDs into one big array instead of querying inside a loop
		const allIdsToDelete: mongoose.Types.ObjectId[] = [];
		for (const doc of duplicates) {
			allIdsToDelete.push(...doc.dupes.slice(1));
		}

		let totalDeleted = 0;
		if (allIdsToDelete.length > 0) {
			const result = await Advice.deleteMany({
				_id: { $in: allIdsToDelete },
			});
			totalDeleted = result.deletedCount;
		}

		return interaction.editReply(
			`Database cleaned! Removed **${totalDeleted}** duplicate advice entries.`,
		);
	},
};

export default clearAdviceDupesCommand;
