import {
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
	type AutocompleteInteraction,
} from "discord.js";
import { SubcommandLoader } from "./lib/subcommand-loader.js";

const mainCommand = new SlashCommandBuilder()
	.setName("quests")
	.setDescription("All quest-related commands");

const loader = new SubcommandLoader(
	mainCommand,
	import.meta.url,
	"quest-commands",
);

// eslint-disable-next-line unicorn/no-top-level-side-effects
await loader.load();

const questsCommand = {
	data: mainCommand,
	async execute(interaction: ChatInputCommandInteraction) {
		// The class handles
		await loader.execute(interaction);
	},
	async autocomplete(interaction: AutocompleteInteraction) {
		await loader.autocomplete(interaction);
	},
};

export default questsCommand;
