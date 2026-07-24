import {
	SlashCommandBuilder,
	MessageFlags,
	type ChatInputCommandInteraction,
	AttachmentBuilder,
} from "discord.js";
import { isOrbitalOwner } from "../lib/helpers/orbital-identity.js";
import { buildOrbitalPanel } from "../lib/helpers/orbital-ui.js";

// Backward-compat exports (interaction-handler imports these until Phase 5)
export const ORBITAL_ID = "1114989970839576637";
export const DELTA = 261_331_447_053_164_574n;

const orbitalstoneUserId = "1114989970839576637";
const orbitalStrikeGifLink = "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExMDkwZ3c5anBhbmM4djN0Y2h2ZXg5bjgyemIxNnBtMzNmM2ZpY3BiZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/amqu1ibx77X1wdDnr5/giphy.gif";
const orbitalStrikeGif = new AttachmentBuilder(orbitalStrikeGifLink).setName("orbital.gif");

const orbitalcannonCommand = {
	data: new SlashCommandBuilder()
		.setName("orbital")
		.setDescription("use the orbital cannon")
		.setContexts([0, 1, 2])
		.setIntegrationTypes([0, 1])
		.addUserOption((option) =>
			option
				.setName("target")
				.setDescription("The target of the orbital strike")
				.setRequired(false)
		),

	async execute(interaction: ChatInputCommandInteraction) {
		if (!isOrbitalOwner(interaction.user.id) && interaction.user.id !== orbitalstoneUserId) {
			return interaction.reply({
				content: `<@${interaction.user.id}> tried to use the orbital cannon but miserably failed.`,
			});
		}

		if (interaction.user.id === orbitalstoneUserId) {
			await interaction.reply({
				content: `<@${interaction.user.id}> used the orbital strike cannon.`,
				files: [orbitalStrikeGif],
			});
			const target = interaction.options.getUser("target");
			if (target) {
				await interaction.followUp({
					content: `<@${target.id}> has been thoroughly incinerated`,
					allowedMentions: { parse: [] },
				});
			}

			return;
		}

		const panel = buildOrbitalPanel();
		return interaction.reply({
			...panel,
			flags: [MessageFlags.Ephemeral],
		});
	},
};

export default orbitalcannonCommand;
