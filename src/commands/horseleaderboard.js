const {
	SlashCommandBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	MessageFlags,
} = require('discord.js');
const mongoose = require('mongoose');
const HORSE_VALUES = require('../horses.json');

const PAGE_SIZE = 10;
module.exports = {
	data: new SlashCommandBuilder()
		.setName('horseleaderboard')
		.setDescription('View the richest horse collectors')
		.addIntegerOption((opt) =>
			opt
				.setName('page')
				.setDescription('Page number to view (starts at 1)')
				.setMinValue(1),
		),
	async execute(interaction) {
		await interaction.deferReply();
		// Fetch only needed fields for speed
		const allUsers = await mongoose
			.model('UserHorses')
			.find({}, {userId: 1, horses: 1, horseCoins: 1});
		const totalPossibleItems = Object.values(HORSE_VALUES).filter(
			(v) => v.comp !== false,
		).length;

		// Precompute leaderboard data
		const data = allUsers.map((u) => {
			let worth = 0;
			let unique = 0;
			for (const [name, count] of u.horses) {
				if (count > 0) {
					const horseData = HORSE_VALUES[name];
					if (!horseData) continue;
					worth += horseData.value * count;
					if (horseData.comp !== false) unique++;
				}
			}

			return {
				userId: u.userId,
				worth,
				horseCoins: u.horseCoins || 0,
				completion: Math.round((unique / totalPossibleItems) * 100),
			};
		});

		const worthSort = [...data].sort((a, b) => b.worth - a.worth);
		const compSort = [...data].sort((a, b) => b.completion - a.completion);
		const coinSort = [...data].sort((a, b) => b.horseCoins - a.horseCoins);

		const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
		// Get page from option, default to 1
		let currentPage = (interaction.options.getInteger('page') || 1) - 1;
		if (currentPage < 0) currentPage = 0;
		if (currentPage >= totalPages) currentPage = totalPages - 1;

		// Helper to fetch usernames for only the current page, with timeout and cache
		const userCache = new Map();
		async function getUserNamesForPage(list, page) {
			const start = page * PAGE_SIZE;
			const current = list.slice(start, start + PAGE_SIZE);
			const ids = current.map((item) => item.userId);
			// Fetch all users in parallel, but with a timeout and cache
			const results = await Promise.all(
				ids.map(async (userId) => {
					if (userCache.has(userId)) return userCache.get(userId);
					// Timeout wrapper for fetch
					function fetchWithTimeout(promise, ms) {
						return Promise.race([
							promise,
							new Promise((resolve) => setTimeout(() => resolve(null), ms)),
						]);
					}

					try {
						const user = await fetchWithTimeout(
							interaction.client.users.fetch(userId),
							2000,
						);
						const name = user?.displayName || user?.username || 'Unknown User';
						userCache.set(userId, name);
						return name;
					} catch {
						userCache.set(userId, 'Unknown User');
						return 'Unknown User';
					}
				}),
			);
			return results;
		}

		// Build leaderboard string for a given list and page
		async function buildList(list, type, page) {
			const start = page * PAGE_SIZE;
			const current = list.slice(start, start + PAGE_SIZE);
			let names;
			try {
				names = await getUserNamesForPage(list, page);
			} catch {
				names = current.map(() => 'Unknown User');
			}

			let string_ = '';
			for (const [i, item] of current.entries()) {
				const name = names[i] || 'Unknown User';
				const rank = start + i + 1;
				const value =
					type === 'worth'
						? `$${item.worth.toLocaleString()}`
						: type === 'coins'
							? `${item.horseCoins.toLocaleString()} 🪙`
							: `${item.completion}%`;
				string_ += `**${rank}.** ${name}: ${value}\n`;
			}

			return string_ || 'No data.';
		}

		async function buildEmbed(page) {
			return new EmbedBuilder()
				.setTitle(
					`🐎 Horse Collector Leaderboards (Page ${page + 1}/${totalPages})`,
				)
				.setColor('#f1c40f')
				.addFields(
					{
						name: '💰 Horse Net Worth',
						value: await buildList(worthSort, 'worth', page),
						inline: true,
					},
					{
						name: '🏆 Completion',
						value: await buildList(compSort, 'comp', page),
						inline: true,
					},
					{
						name: '🪙 Horse Coins',
						value: await buildList(coinSort, 'coins', page),
						inline: true,
					},
				);
		}

		function getButtons(page) {
			return new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId(`hlb_prev_${page}`)
					.setLabel('⬅️')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page === 0),
				new ButtonBuilder()
					.setCustomId(`hlb_next_${page}`)
					.setLabel('➡️')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page >= totalPages - 1),
			);
		}

		await interaction.editReply({
			embeds: [await buildEmbed(currentPage)],
			components: [getButtons(currentPage)],
		});

		const reply = await interaction.fetchReply();
		const collector = reply.createMessageComponentCollector({time: 120_000});

		collector.on('collect', async (i) => {
			if (i.user.id !== interaction.user.id) {
				await i
					.reply({
						content: 'Only the command user can use these buttons.',
						flags: [MessageFlags.Ephemeral],
					})
					.catch(() => {});
				return;
			}

			const [, direction, page] = i.customId.split('_');
			let parsedPage = Number(page);
			if (isNaN(parsedPage)) parsedPage = 0;
			currentPage = direction === 'next' ? parsedPage + 1 : parsedPage - 1;
			if (currentPage < 0) currentPage = 0;
			if (currentPage >= totalPages) currentPage = totalPages - 1;
			try {
				await i.update({
					embeds: [await buildEmbed(currentPage)],
					components: [getButtons(currentPage)],
				});
			} catch {
				await i
					.reply({
						content: 'Failed to update leaderboard page.',
						ephemeral: true,
					})
					.catch(() => {});
			}
		});

		collector.on('end', async () => {
			await interaction
				.editReply({
					embeds: [await buildEmbed(currentPage)],
					components: [],
				})
				.catch(() => {});
		});
	},
};
