import {
	SlashCommandBuilder,
	MessageFlags,
	type ChatInputCommandInteraction,
	InteractionContextType,
} from "discord.js";

const roleId = "1473123914531213532";
// eslint-disable-next-line @typescript-eslint/naming-convention
const { Guild } = InteractionContextType;

const abortbabyCommand = {
	data: new SlashCommandBuilder()
		.setName("abortbaby")
		.setDescription("Abortion is still legal here dw")
		.setContexts([Guild]),
	async execute(interaction: ChatInputCommandInteraction) {
		try {
			if (!interaction.guild || !interaction.user.id) {
				return await interaction.reply({
					content:
						"This command can only be used in a server.",
					flags: [MessageFlags.Ephemeral],
				});
			}

			const member = await interaction.guild.members.fetch(
				interaction.user.id,
			);

			if (!member) {
				return await interaction.reply({
					content:
						"Could not find your member data in this server.",
					flags: [MessageFlags.Ephemeral],
				});
			}

			await member.roles.remove(roleId);
			return await interaction.reply({ content: "Baby aborted" });
		} catch {
			return interaction.reply({
				content: "I couldn't abort the baby for you",
				flags: [MessageFlags.Ephemeral],
			});
		}
	},
};

export default abortbabyCommand;
