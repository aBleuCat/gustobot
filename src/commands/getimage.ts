import {
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
	type AutocompleteInteraction,
} from 'discord.js';

const IMAGES: Record<string, string> = {
	// Example: "cat": "https://example.com/cat.gif",
	nahyan: 'https://i.imgur.com/tmyvHLF.png',
	alvin:
		'https://cdn.discordapp.com/attachments/1448897193736933498/1485341427742408945/togif.gif ',
	nathan:
		'https://cdn.discordapp.com/attachments/1448897193736933498/1485433542438813806/togif.gif ',
};

export const getImageCommand = {
	data: new SlashCommandBuilder()
		.setName('getimage')
		.setDescription('Get an image by name')
		.addStringOption((option) =>
			option
				.setName('name')
				.setDescription('The name of the image')
				.setRequired(true)
				.setAutocomplete(true),
		),

	async autocomplete(interaction: AutocompleteInteraction) {
		const focused = interaction.options.getFocused();
		const choices = Object.keys(IMAGES);
		const filtered = choices.filter((choice) =>
			choice.toLowerCase().includes(focused.toLowerCase()),
		);
		await interaction.respond(
			filtered
				.map((choice) => ({name: choice, value: choice}))
				.slice(0, 25),
		);
	},

	async execute(interaction: ChatInputCommandInteraction) {
		const name = interaction.options.getString('name');
		if (!name) {
			return;
		}

		const imageUrl: string | undefined = IMAGES[name];

		if (!imageUrl) {
			await interaction.reply(
				`Image "${name}" not found. Available: ${Object.keys(IMAGES).join(', ') || 'none'}`,
			);
			return;
		}

		await interaction.reply(imageUrl);
	},
};
