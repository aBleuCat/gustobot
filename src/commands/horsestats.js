const {
	SlashCommandBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	MessageFlags,
} = require('discord.js');
const mongoose = require('mongoose');
const HORSE_VALUES = require('../horses.json');

const HORSES_PER_PAGE = 15;

function horseName(slug) {
	return HORSE_VALUES[slug]?.name ?? slug;
}

function gini(values) {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const n = sorted.length;
	const mean = sorted.reduce((a, b) => a + b, 0) / n;
	if (mean === 0) return 0;
	let numerator = 0;
	for (let i = 0; i < n; i++)
		for (let j = 0; j < n; j++)
			numerator += Math.abs(sorted[i] - sorted[j]);
	return numerator / (2 * n * n * mean);
}

function buildBreakdownPage(sortedHorses, page) {
	const totalPages = Math.ceil(sortedHorses.length / HORSES_PER_PAGE);
	const slice = sortedHorses.slice(
		page * HORSES_PER_PAGE,
		(page + 1) * HORSES_PER_PAGE,
	);
	const lines = [
		`🐴 **Horse Breakdown** (page ${page + 1}/${totalPages})`,
		'',
		...slice.map(
			([slug, count]) => `* **${horseName(slug)}**: ${count}`,
		),
	];
	return lines.join('\n');
}

function buildPageButtons(page, totalPages, statsId) {
	return new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId(`hstats::${statsId}::${page - 1}`)
			.setLabel('◀')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(page === 0),
		new ButtonBuilder()
			.setCustomId(`hstats::${statsId}::${page + 1}`)
			.setLabel('▶')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(page === totalPages - 1),
	);
}

const breakdownStore = new Map();

module.exports = {
	data: new SlashCommandBuilder()
		.setName('horsestats')
		.setDescription('View global horse economy statistics'),

	async handleButton(interaction) {
		const [, statsId, pageString] = interaction.customId.split('::');
		const page = Number.parseInt(pageString);
		const sortedHorses = breakdownStore.get(statsId);

		if (!sortedHorses) {
			return interaction.reply({
				content:
					'This stats session has expired. Run /horsestats again.',
				flags: [MessageFlags.Ephemeral],
			});
		}

		const totalPages = Math.ceil(
			sortedHorses.length / HORSES_PER_PAGE,
		);
		const content = buildBreakdownPage(sortedHorses, page);
		const row = buildPageButtons(page, totalPages, statsId);
		await interaction.update({content, components: [row]});
	},

	async execute(interaction) {
		await interaction.deferReply();

		const UserHorses = mongoose.model('UserHorses');
		const allUsers = await UserHorses.find({});

		if (allUsers.length === 0)
			return interaction.editReply('No horse data yet!');

		const horseCounts = {};
		const playerWealth = [];
		const playerHorseCounts = [];
		let totalCoins = 0;
		let totalHorses = 0;
		let totalWealth = 0;
		let playersWithHorses = 0;

		for (const user of allUsers) {
			let userWealth = 0;
			let userHorseCount = 0;
			totalCoins += user.horseCoins || 0;

			if (user.horses) {
				for (const [slug, count] of user.horses.entries()) {
					if (count <= 0) continue;
					horseCounts[slug] = (horseCounts[slug] || 0) + count;
					totalHorses += count;
					userWealth += (HORSE_VALUES[slug]?.value || 0) * count;
					userHorseCount += count;
				}
			}

			if (userWealth > 0 || (user.horseCoins || 0) > 0) {
				playersWithHorses++;
				totalWealth += userWealth;
				playerWealth.push(userWealth);
				playerHorseCounts.push(userHorseCount);
			}
		}

		const playersSorted = playerWealth
			.map((wealth, i) => ({wealth, horses: playerHorseCounts[i]}))
			.sort((a, b) => b.wealth - a.wealth);

		const n = playersSorted.length;

		function sliceStats(players) {
			const wealth = players.reduce((sum, p) => sum + p.wealth, 0);
			const horses = players.reduce((sum, p) => sum + p.horses, 0);
			return {
				count: players.length,
				wealth,
				horses,
				wealthPct:
					totalWealth > 0
						? ((wealth / totalWealth) * 100).toFixed(1)
						: '0.0',
				horsesPct:
					totalHorses > 0
						? ((horses / totalHorses) * 100).toFixed(1)
						: '0.0',
			};
		}

		const top1Count = Math.max(1, Math.ceil(n * 0.01));
		const top1Stats = sliceStats(playersSorted.slice(0, top1Count));
		const top10Count = Math.max(1, Math.ceil(n * 0.1));
		const top10Stats = sliceStats(playersSorted.slice(0, top10Count));
		const bottom50Count = Math.max(1, Math.floor(n * 0.5));
		const bottom50Stats = sliceStats(
			playersSorted.slice(n - bottom50Count),
		);

		const giniScore = gini(playerWealth);
		const avgWealth =
			playersWithHorses > 0
				? Math.round(totalWealth / playersWithHorses)
				: 0;
		const richest = Math.max(...playerWealth);

		const sortedByCount = Object.entries(horseCounts).sort(
			(a, b) => b[1] - a[1],
		);
		const top5Common = sortedByCount.slice(0, 5);
		const top5ByValue = Object.entries(horseCounts)
			.map(([slug, count]) => ({
				slug,
				count,
				totalValue: (HORSE_VALUES[slug]?.value || 0) * count,
			}))
			.sort((a, b) => b.totalValue - a.totalValue)
			.slice(0, 5);

		const rarest = Object.entries(horseCounts)
			.filter(([, count]) => count > 0)
			.sort((a, b) =>
				a[1] === b[1]
					? (HORSE_VALUES[b[0]]?.value || 0) -
						(HORSE_VALUES[a[0]]?.value || 0)
					: a[1] - b[1],
			)[0];

		const statsLines = [
			`📊 **Horse Economy Stats**`,
			``,
			`👥 **Players**: ${playersWithHorses}`,
			`🐎 **Total Horses**: ${totalHorses} across ${Object.keys(horseCounts).length} unique breeds`,
			`🪙 **Total Horse Coins**: ${totalCoins}`,
			`💰 **Total Wealth**: $${totalWealth.toLocaleString()}`,
			`📈 **Avg Wealth per Player**: $${avgWealth.toLocaleString()}`,
			`🤑 **Richest Player**: $${richest.toLocaleString()}`,
			`⚖️ **Wealth Inequality (Gini)**: ${(giniScore * 100).toFixed(1)}% ${giniScore > 0.7 ? '😬' : giniScore > 0.4 ? '😐' : '😌'}`,
			``,
			`📉 **Wealth Distribution**`,
			`* 🥇 **Top 1%** (${top1Stats.count} player${top1Stats.count === 1 ? '' : 's'}): $${top1Stats.wealth.toLocaleString()} — **${top1Stats.wealthPct}%** of wealth · **${top1Stats.horsesPct}%** of horses (${top1Stats.horses})`,
			`* 🏅 **Top 10%** (${top10Stats.count} player${top10Stats.count === 1 ? '' : 's'}): $${top10Stats.wealth.toLocaleString()} — **${top10Stats.wealthPct}%** of wealth · **${top10Stats.horsesPct}%** of horses (${top10Stats.horses})`,
			`* 📊 **Bottom 50%** (${bottom50Stats.count} player${bottom50Stats.count === 1 ? '' : 's'}): $${bottom50Stats.wealth.toLocaleString()} — **${bottom50Stats.wealthPct}%** of wealth · **${bottom50Stats.horsesPct}%** of horses (${bottom50Stats.horses})`,
			``,
			`🏆 **Most Common Horses**`,
			...top5Common.map(
				([slug, count]) => `* **${horseName(slug)}**: ${count}`,
			),
			``,
			`💎 **Most Wealth in Circulation**`,
			...top5ByValue.map(
				({slug, count, totalValue}) =>
					`* **${horseName(slug)}**: ${count}x ($${totalValue.toLocaleString()} total)`,
			),
			``,
			rarest
				? `🦄 **Rarest Owned**: **${horseName(rarest[0])}** (only ${rarest[1]} exist)`
				: '',
		].filter((l) => l !== undefined);

		await interaction.editReply({content: statsLines.join('\n')});

		const statsId = `${interaction.user.id}-${Date.now()}`;
		breakdownStore.set(statsId, sortedByCount);
		setTimeout(() => breakdownStore.delete(statsId), 5 * 60 * 1000);

		const totalPages = Math.ceil(
			sortedByCount.length / HORSES_PER_PAGE,
		);
		await interaction.followUp({
			content: buildBreakdownPage(sortedByCount, 0),
			components: [buildPageButtons(0, totalPages, statsId)],
		});
	},
};
