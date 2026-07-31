import {
	SlashCommandBuilder,
	MessageFlags,
	PermissionFlagsBits,
	type AutocompleteInteraction,
	type ChatInputCommandInteraction,
} from "discord.js";
import { SubcommandLoader } from "./lib/subcommand-loader.js";
import { adminIds } from "./hacks-commands/shared.js";

const mainCommand = new SlashCommandBuilder()
	.setName("hacks")
	.setDescription("Admin tools")
	.setDefaultMemberPermissions(
		PermissionFlagsBits.Administrator,
	);

const loader = new SubcommandLoader(
	mainCommand,
	import.meta.url,
	"hacks-commands",
);

// eslint-disable-next-line unicorn/no-top-level-side-effects
await loader.load();

const hacksCommand = {
	data: mainCommand,
	async autocomplete(interaction: AutocompleteInteraction) {
		await loader.autocomplete(interaction);
	},
	async execute(interaction: ChatInputCommandInteraction) {
		if (!adminIds.has(interaction.user.id)) {
			return interaction.reply({
				content: "you cannot do that bro",
				flags: [MessageFlags.Ephemeral],
			});
		}

		await loader.execute(interaction);
	},
};

export default hacksCommand;
