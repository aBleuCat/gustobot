import {
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
	type AutocompleteInteraction,
} from "discord.js";
import { SubcommandLoader } from "./lib/subcommand-loader.js";

const mainCommand = new SlashCommandBuilder()
	.setName("trained")
	.setDescription("Check out and deal with your trained horses");

const loader = new SubcommandLoader(
	mainCommand,
	import.meta.url,
	"trained-commands",
);

// eslint-disable-next-line unicorn/no-top-level-side-effects
await loader.load();

const trainedCommand = {
	data: mainCommand,
	async execute(interaction: ChatInputCommandInteraction) {
		await loader.execute(interaction);
	},
	async autocomplete(interaction: AutocompleteInteraction) {
		await loader.autocomplete(interaction);
	},
};

export default trainedCommand;
