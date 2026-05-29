import {
	SlashCommandSubcommandBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	MessageFlags,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
} from 'discord.js';
import mongoose from 'mongoose';
import rawHorseValues from '../../data/horses.json' with {type: 'json'};
import {castAsHorseData} from '../../type-utils.js';
import {horseName} from '../../lib/helpers/horse-funcs.js';
import type {IUserHorses} from '../../lib/models.js';

const HORSES_PER_PAGE = 15;

const HORSE_VALUES = castAsHorseData(rawHorseValues);

type HorseCountEntry = [string, number];
type PlayerStats = {wealth: number; horses: number};

type BreakdownStats = {
	count: number;
	wealth: number;
	horses: number;
	wealthPct: string;
	horsesPct: string;
};

function sliceStats(
	players: PlayerStats[],
	totalWealth: number,
	totalHorses: number,
): BreakdownStats {
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

function aggregateHorseStats(users: IUserHorses[]) {
	const horseCounts: Record<string, number> = {};
	const playerWealth: number[] = [];
	const playerHorseCounts: number[] = [];
	let totalCoins = 0;
	let totalHorses = 0;
	let totalWealth = 0;
	let playersWithHorses = 0;

	for (const user of users) {
		let userWealth = 0;
		let userHorseCount = 0;
		totalCoins += user.horseCoins ?? 0;

		if (user.horses) {
			for (const [slug, count] of user.horses.entries()) {
				if (count <= 0) continue;
				horseCounts[slug] = (horseCounts[slug] ?? 0) + count;
				totalHorses += count;
				userWealth += (HORSE_VALUES[slug]?.value ?? 0) * count;
				userHorseCount += count;
			}
		}

		if (userWealth > 0 || (user.horseCoins ?? 0) > 0) {
			playersWithHorses++;
			totalWealth += userWealth;
			playerWealth.push(userWealth);
			playerHorseCounts.push(userHorseCount);
		}
	}

	return {
		horseCounts,
		playerWealth,
		playerHorseCounts,
		totalCoins,
		totalHorses,
		totalWealth,
		playersWithHorses,
	};
}

function gini(values: number[]) {
	if (values.length === 0) return 0;
	const sorted = values.toSorted((a, b) => a - b);
	const n = sorted.length;
	const mean = sorted.reduce((sum, value) => sum + value, 0) / n;
	if (mean === 0) return 0;
	let numerator = 0;
	for (const xi of sorted) {
		for (const xj of sorted) {
			numerator += Math.abs(xi - xj);
		}
	}

	return numerator / (2 * n * n * mean);
}

function buildBreakdownPage(
	sortedHorses: HorseCountEntry[],
	page: number,
) {
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

function attachHorseStatsCollector(
	response: {
		createMessageComponentCollector(options: {time: number}): {
			on(
				event: 'collect',
				listener: (i: ButtonInteraction) => void,
			): void;
		};
	},
	sortedByCount: HorseCountEntry[],
	totalPages: number,
	interaction: ChatInputCommandInteraction,
) {
	const collector = response.createMessageComponentCollector({
		time: 120_000,
	});

	collector.on('collect', (i: ButtonInteraction) => {
		void (async () => {
			if (i.user.id !== interaction.user.id) {
				await i
					.reply({
						content: 'Only the command user can use these buttons.',
						flags: [MessageFlags.Ephemeral],
					})
					.catch(() => undefined);
				return;
			}

			const [, direction, pageString] = i.customId.split('_');
			if (!pageString) return;

			const requestedPage = Number.parseInt(pageString, 10);
			if (Number.isNaN(requestedPage)) return;

			const page = Math.min(
				Math.max(requestedPage, 0),
				totalPages - 1,
			);

			await i.update({
				content: buildBreakdownPage(sortedByCount, page),
				components: [buildPageButtons(page, totalPages).toJSON()],
			});
		})().catch(() => undefined);
	});
}

function buildPageButtons(page: number, totalPages: number) {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`hstats_prev_${page}`)
			.setLabel('◀')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(page === 0),
		new ButtonBuilder()
			.setCustomId(`hstats_next_${page}`)
			.setLabel('▶')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(page >= totalPages - 1),
	);
}

export const data = new SlashCommandSubcommandBuilder()
	.setName('stats')
	.setDescription('View global horse economy statistics');

export async function execute(
	interaction: ChatInputCommandInteraction,
) {
	await interaction.deferReply();

	// eslint-disable-next-line @typescript-eslint/naming-convention
	const UserHorses = mongoose.model<IUserHorses>('UserHorses');
	const allUsers = await UserHorses.find({});

	if (allUsers.length === 0) {
		return interaction.editReply('No horse data yet!');
	}

	const {
		horseCounts,
		playerWealth,
		playerHorseCounts,
		totalCoins,
		totalHorses,
		totalWealth,
		playersWithHorses,
	} = aggregateHorseStats(allUsers);

	const playersSorted: PlayerStats[] = playerWealth
		.map((wealth, i) => ({wealth, horses: playerHorseCounts[i] ?? 0}))
		.toSorted((a, b) => b.wealth - a.wealth);

	const n = playersSorted.length;

	const top1Count = Math.max(1, Math.ceil(n * 0.01));
	const top1Stats = sliceStats(
		playersSorted.slice(0, top1Count),
		totalWealth,
		totalHorses,
	);
	const top10Count = Math.max(1, Math.ceil(n * 0.1));
	const top10Stats = sliceStats(
		playersSorted.slice(0, top10Count),
		totalWealth,
		totalHorses,
	);
	const bottom50Count = Math.max(1, Math.floor(n * 0.5));
	const bottom50Stats = sliceStats(
		playersSorted.slice(n - bottom50Count),
		totalWealth,
		totalHorses,
	);

	const giniScore = gini(playerWealth);
	const avgWealth =
		playersWithHorses > 0
			? Math.round(totalWealth / playersWithHorses)
			: 0;
	const richest =
		playersWithHorses > 0 ? Math.max(...playerWealth) : 0;

	const sortedByCount: HorseCountEntry[] = Object.entries(
		horseCounts,
	).toSorted((a, b) => b[1] - a[1]);
	const top5Common = sortedByCount.slice(0, 5);
	const top5ByValue = sortedByCount
		.map(([slug, count]) => ({
			slug,
			count,
			totalValue: (HORSE_VALUES[slug]?.value ?? 0) * count,
		}))
		.toSorted((a, b) => b.totalValue - a.totalValue)
		.slice(0, 5);

	const rarest = sortedByCount
		.filter(([, count]) => count > 0)
		.toSorted((a, b) =>
			a[1] === b[1]
				? (HORSE_VALUES[b[0]]?.value ?? 0) -
					(HORSE_VALUES[a[0]]?.value ?? 0)
				: a[1] - b[1],
		)[0];

	const statsLines = [
		`📊 **Horse Economy Stats**`,
		``,
		`👥 **Players**: ${playersWithHorses}`,
		`🐎 **Total Horses**: ${totalHorses} across ${Object.keys(horseCounts).length} unique breeds`,
		`🪙 **Total Horse Coins**: ${totalCoins}`,
		`💰 **Total Wealth**: $${totalWealth.toLocaleString()}`,
		`📈 **Avg. Wealth per Player**: $${avgWealth.toLocaleString()}`,
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
			? `🦄 **Rarest in Existance**: **${horseName(rarest[0])}** (only ${rarest[1]} exist)`
			: '',
	].filter((l): l is string => l !== undefined);

	await interaction.editReply({content: statsLines.join('\n')});

	const totalPages = Math.max(
		1,
		Math.ceil(sortedByCount.length / HORSES_PER_PAGE),
	);
	const response = await interaction.followUp({
		content: buildBreakdownPage(sortedByCount, 0),
		components: [buildPageButtons(0, totalPages).toJSON()],
		fetchReply: true,
	});

	attachHorseStatsCollector(
		response,
		sortedByCount,
		totalPages,
		interaction,
	);
}
