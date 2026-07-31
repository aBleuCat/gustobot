import {
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
	MessageFlags,
} from "discord.js";
import { AdviceBan } from "../lib/models.js";
import { immutConfig } from "../lib/config.js";

const banAdviceCommand = {
	data: new SlashCommandBuilder()
		.setName("banadvice")
		.setDescription(
			"Bans or unbans a user from using the advicegive command (Owner Only)",
		)
		.addUserOption((option) =>
			option
				.setName("user")
				.setDescription("The user to ban/unban")
				.setRequired(true),
		),

	async execute(interaction: ChatInputCommandInteraction) {
		// Owner ID Check
		if (!immutConfig.ADMINS.has(interaction.user.id)) {
			return interaction.reply({
				content:
					"You do not have permission to use this command.",
				flags: [MessageFlags.Ephemeral],
			});
		}

		const target = interaction.options.getUser("user");

		if (!target)
			{return interaction.reply(
				"Something went wrong when recieving your target input",
			);}

		const exists = await AdviceBan.findOne({ userId: target.id });

		if (exists) {
			await AdviceBan.deleteOne({ userId: target.id });
			return interaction.reply(
				`Unbanned **${target.username}** from giving advice.`,
			);
		}

		await new AdviceBan({ userId: target.id }).save();
		return interaction.reply(
			`Banned **${target.username}** from giving advice.`,
		);
	},
};

export default banAdviceCommand;
