import { SlashCommandSubcommandBuilder } from "discord.js";

export const data = new SlashCommandSubcommandBuilder()
	.setName("start")
	.setDescription("Trade horses and horse coin with people")
	.addUserOption((option) =>
		option
			.setName("user")
			.setDescription("User you wish to trade with")
			.setRequired(true),
	);
