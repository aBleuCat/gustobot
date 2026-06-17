import {
	SlashCommandBuilder,
	EmbedBuilder,
	type ChatInputCommandInteraction,
} from "discord.js";
import { immutConfig } from "../lib/config.js";
import { LolStats } from "../lib/models.js";

const lolStatsCommand = {
	data: new SlashCommandBuilder()
		.setName("lolstats")
		.setDescription("Shows how many times the bot has said lol"),

	async execute(interaction: ChatInputCommandInteraction) {
		const stats = await LolStats.findOne({ id: "global_stats" });

		if (!stats?.lastTimestamp) {
			return interaction.reply(
				"No lols have been recorded in the database yet!",
			);
		}

		// Convert stored ms to unix seconds for discord timestamps
		const unixSeconds = Math.floor(
			stats.lastTimestamp / immutConfig.SECOND_MS,
		);
		const discordTime = `<t:${unixSeconds}:f>`; // Full, e.g., February 20, 2026 5:31 AM
		const relativeTime = `<t:${unixSeconds}:R>`; // Relative, e.g., 5 minutes ago

		const embed = new EmbedBuilder()
			.setColor("#ffea00") // Cheese
			.setTitle("lol Counter")
			.addFields(
				{
					name: "Today",
					value: `${stats.daily}`,
					inline: true,
				},
				{
					name: "This Week",
					value: `${stats.weekly}`,
					inline: true,
				},
				{
					name: "All Time",
					value: `${stats.allTime}`,
					inline: true,
				},
				{
					name: "Last Lol",
					value: `${discordTime} (${relativeTime})`,
					inline: false,
				},
			);

		await interaction.reply({ embeds: [embed] });
	},
};

export default lolStatsCommand;
