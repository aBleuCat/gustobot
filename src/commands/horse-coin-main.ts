import {
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
	type AutocompleteInteraction,
} from 'discord.js';
import {SubcommandLoader} from './lib/subcommand-loader.js';

const mainCommand = new SlashCommandBuilder()
	.setName('coins')
	.setDescription('All horse-coin-related commands');

const loader = new SubcommandLoader(
	mainCommand,
	import.meta.url,
	'coin-commands',
);

await loader.load();

const command = {
	data: mainCommand,
	async execute(interaction: ChatInputCommandInteraction) {
		// The class handles
		await loader.execute(interaction);
	},
	async autocomplete(interaction: AutocompleteInteraction) {
		await loader.autocomplete(interaction);
	},
};

export default command;
