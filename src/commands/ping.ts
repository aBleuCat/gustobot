import {
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
} from "discord.js";

const pingCommand = {
	data: new SlashCommandBuilder()
		.setName("ping")
		.setDescription("Test command"),

	async execute(interaction: ChatInputCommandInteraction) {
		await interaction.reply("Pong!");
	},
};
export default pingCommand;
