import {
	SlashCommandBuilder,
	PermissionFlagsBits,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	MessageFlags,
	type ChatInputCommandInteraction,
} from 'discord.js';
import mongoose from 'mongoose';
import type {IAdvice} from '../lib/models.js';

const adviceListCommand = {
	data: new SlashCommandBuilder()
		.setName('advicelist')
		.setDescription('Shows stored advice in pages (Admin Only)')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	async execute(interaction: ChatInputCommandInteraction) {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		const Advice = mongoose.model<IAdvice>('Advice');
		const advices = await Advice.find({});

		if (advices.length === 0)
			return interaction.reply(
				'The circle of advice is currently empty.',
			);

		const generateEmbed = (page: number) => {
			const start = page * 10;
			const current = advices.slice(start, start + 10);

			const embed = new EmbedBuilder()
				.setTitle(
					`📜 Scrolls of Muy Advice (Page ${page + 1}/${Math.ceil(advices.length / 10)})`,
				)
				.setColor('#00ae86')
				.setDescription(
					current
						.map((a, i) => `**${start + i + 1}.** ${a.content}`)
						.join('\n') || 'No more advice.',
				);

			return embed;
		};

		const generateButtons = (page: number) => {
			const row = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId(`adv_prev_${page}`)
					.setLabel('Previous')
					.setStyle(ButtonStyle.Primary)
					.setDisabled(page === 0),
				new ButtonBuilder()
					.setCustomId(`adv_next_${page}`)
					.setLabel('Next')
					.setStyle(ButtonStyle.Primary)
					.setDisabled((page + 1) * 10 >= advices.length),
			);
			return row.toJSON();
		};

		const response = await interaction.reply({
			embeds: [generateEmbed(0)],
			components: [generateButtons(0)],
			flags: [MessageFlags.Ephemeral],
		});

		// Collector to handle button clicks
		const collector = response.createMessageComponentCollector({
			time: 60_000,
		});

		collector.on('collect', (i) => {
			(async () => {
				const [type, direction, currentPage] = i.customId.split('_');
				if (type !== 'adv') return;
				if (currentPage === undefined) return;

				const newPage =
					direction === 'next'
						? Number.parseInt(currentPage, 10) + 1
						: Number.parseInt(currentPage, 10) - 1;

				await i.update({
					embeds: [generateEmbed(newPage)],
					components: [generateButtons(newPage)],
				});
			})().catch((error: unknown) => {
				console.error('Collector execution failed:', error);
			});
		});
	},
};

export default adviceListCommand;
