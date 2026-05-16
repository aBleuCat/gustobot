import {
	SlashCommandBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	MessageFlags,
	type ChatInputCommandInteraction,
	type ButtonInteraction,
} from 'discord.js';
import mongoose from 'mongoose';

// Define the shape of your ActionResponse documents
type ActionResponseDocument = {
	trigger: string;
	response: string;
};

export const actionsList = {
	data: new SlashCommandBuilder()
		.setName('actionslist')
		.setDescription('Shows all learned actions'),
	async execute(interaction: ChatInputCommandInteraction) {
		if (interaction.user.id !== '934290747623096381') {
			return interaction.reply({
				content: 'Only the great .i.exist can view these.',
				flags: [MessageFlags.Ephemeral],
			});
		}

		// Tell Mongoose exactly what type array to expect
		const actionResponse =
			mongoose.model<ActionResponseDocument>('ActionResponse');
		const actions = await actionResponse.find({}).lean();

		if (actions.length === 0) {
			return interaction.reply("I haven't learned any actions yet.");
		}

		// Type 'page' explicitly as a number
		const generateEmbed = (page: number): EmbedBuilder => {
			const start = page * 10;
			const current = actions.slice(start, start + 10);

			return new EmbedBuilder()
				.setTitle(
					`🛠 Learned Actions (Page ${page + 1}/${Math.ceil(actions.length / 10)})`,
				)
				.setColor(0xff_a5_00)
				.setDescription(
					current
						.map((act) => `• **${act.trigger}** → ${act.response}`)
						.join('\n'),
				);
		};

		// Type the row builder so it knows it holds ButtonBuilders
		const generateButtons = (
			page: number,
		): ActionRowBuilder<ButtonBuilder> =>
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId(`act_prev_${page}`)
					.setLabel('⬅️')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page === 0),
				new ButtonBuilder()
					.setCustomId(`act_next_${page}`)
					.setLabel('➡️')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled((page + 1) * 10 >= actions.length),
			);

		const response = await interaction.reply({
			embeds: [generateEmbed(0)],
			components: [generateButtons(0)],
			flags: [MessageFlags.Ephemeral],
		});

		const collector = response.createMessageComponentCollector({
			time: 60_000,
		});

		// Type 'i' as a ButtonInteraction so customId, split, and update resolve cleanly
		// Pass a regular function to 'collect', satisfying the void requirement
		collector.on('collect', (i: ButtonInteraction) => {
			// Run your async operations inside a self-contained block
			void (async () => {
				const [, direction, currentPage] = i.customId.split('_');

				if (!currentPage) return;

				const newPage =
					direction === 'next'
						? Number.parseInt(currentPage, 10) + 1
						: Number.parseInt(currentPage, 10) - 1;

				await i.update({
					embeds: [generateEmbed(newPage)],
					components: [generateButtons(newPage)],
				});
			})().catch((error: unknown) => {
				console.error('Failed to update interaction page:', error);
			});
		});
	},
};
