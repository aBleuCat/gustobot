import {
	SlashCommandSubcommandBuilder,
	MessageFlags,
	type AutocompleteInteraction,
	type ChatInputCommandInteraction,
} from 'discord.js';
import mongoose from 'mongoose';
import type {IUserHorses} from '../../lib/models.js';
import rawHorseValues from '../../data/horses.json' with {type: 'json'};
import {castAsHorseData} from '../../type-utils.js';
import {config} from '../../lib/config.js';
import {devLog} from '../../lib/helpers/dev-log.js';
import {horseName} from '../../lib/helpers/horse-funcs.js';
import {handleCommandError} from '../../lib/helpers/error-handlers.js';

const SELL_PRICE = config.COMMON_SELL_PRICE;
const HORSE_VALUES = castAsHorseData(rawHorseValues);

// Returns [{slug, value, count}] sorted by value; does not expand by count to avoid OOM
function getSortedHorseList(inventory: IUserHorses, sortDir = 'asc') {
	const list = [];
	for (const [slug, count] of inventory.horses.entries()) {
		if (count > 0 && HORSE_VALUES[slug]) {
			list.push({slug, value: HORSE_VALUES[slug].value, count});
		}
	}

	list.sort((a, b) =>
		sortDir === 'asc' ? a.value - b.value : b.value - a.value,
	);
	return list;
}

function coinValueForSlug(slug: string) {
	const horseValue = HORSE_VALUES[slug]?.value;
	if (!horseValue)
		throw new Error(`Slug ${slug} is not in HORSE_VALUES`);
	return Math.max(1, Math.floor((horseValue * SELL_PRICE) / 25));
}

export const data = new SlashCommandSubcommandBuilder()
	.setName('sell')
	.setDescription('Sell a horse for horse coin')
	.addStringOption((option) =>
		option
			.setName('horse')
			.setDescription('The horse to sell, "top", or "bottom"')
			.setRequired(true)
			.setAutocomplete(true),
	)
	.addIntegerOption((option) =>
		option
			.setName('amount')
			.setDescription(
				'How many to sell (0 = all of that horse, or all top/bottom)',
			)
			.setRequired(false)
			.setMinValue(0),
	);

export async function autocomplete(
	interaction: AutocompleteInteraction,
) {
	try {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		const UserHorses = mongoose.model<IUserHorses>('UserHorses');
		const focused = interaction.options
			.getFocused()
			.toLowerCase();
		const inventory = await UserHorses.findOne({
			userId: interaction.user.id,
		});

		const choices = [
			{
				name: '📈 top — sell most valuable horses',
				value: 'top',
			},
			{
				name: '📉 bottom — sell least valuable horses',
				value: 'bottom',
			},
		];
		if (inventory?.horses) {
			for (const [slug, count] of inventory.horses.entries()) {
				if (count > 0 && HORSE_VALUES[slug]) {
					choices.push({
						name: `${horseName(slug)} (x${count})`,
						value: slug,
					});
				}
			}
		}

		await interaction.respond(
			choices
				.filter((c) => c.name.toLowerCase().includes(focused))
				.slice(0, 25),
		);
	} catch (error) {
		console.error('horsesell autocomplete error:', error);
		try {
			await interaction.respond([]);
		} catch {
			return undefined;
		}
	}
}

async function topOrBottomBulkSell(
	interaction: ChatInputCommandInteraction,
	inventory: IUserHorses,
	isTop: boolean,
	amount: number,
) {
	const sorted = getSortedHorseList(
		inventory,
		isTop ? 'desc' : 'asc',
	);
	if (sorted.length === 0) {
		return interaction.editReply({
			content: `You don't have any horses to sell!`,
		});
	}

	// Walk sorted slugs, taking up to 'amount' total horses across slugs
	const sellMap = new Map<string, number>();
	let remaining = amount === 0 ? Infinity : amount;
	for (const {slug, count} of sorted) {
		if (remaining <= 0) break;
		const take =
			amount === 0 ? count : Math.min(count, remaining);
		sellMap.set(slug, take);
		remaining -= take;
	}

	const totalTaken = [...sellMap.values()].reduce(
		(a, b) => a + b,
		0,
	);
	let totalCoins = 0;
	for (const [slug, cnt] of sellMap.entries()) {
		inventory.horses.set(
			slug,
			(inventory.horses.get(slug) ?? 0) - cnt,
		);
		totalCoins += (coinValueForSlug(slug) ?? 0) * cnt;
	}

	inventory.horseCoins = (inventory.horseCoins ?? 0) + totalCoins;
	inventory.markModified('horses');
	await inventory.save();

	const label = isTop ? 'most valuable' : 'least valuable';
	const lines = [...sellMap.entries()]
		.toSorted(
			(a, b) =>
				(HORSE_VALUES[b[0]]?.value ?? 0) -
				(HORSE_VALUES[a[0]]?.value ?? 0),
		)
		.map(
			([slug, cnt]) =>
				`* ${cnt}x **${horseName(slug)}** → ${(coinValueForSlug(slug) ?? 0) * cnt} 🪙`,
		)
		.join('\n');

	devLog(
		`/horsesell: ${interaction.user.tag} sold ${totalTaken} ${label} horses for ${totalCoins} coins.`,
	).catch(async (error: unknown) =>
		handleCommandError(error, interaction),
	);
	return interaction.editReply(
		`Sold **${totalTaken}** ${label} horse${totalTaken === 1 ? '' : 's'} for **${totalCoins}** 🪙 total!\n${lines}`,
	);
}

async function standardHorseSell(
	interaction: ChatInputCommandInteraction,
	inventory: IUserHorses,
	horseSlug: string,
	amount: number,
) {
	const owned = inventory.horses.get(horseSlug) ?? 0;
	const sellAmount = amount === 0 ? owned : amount;

	if (owned < sellAmount || sellAmount <= 0) {
		return interaction.editReply({
			content: `You don't have ${sellAmount > 1 ? `**${sellAmount}x** ` : 'a '}**${horseName(horseSlug)}**!`,
		});
	}

	const coinsEarned =
		(coinValueForSlug(horseSlug) ?? 0) * sellAmount;
	inventory.horses.set(horseSlug, owned - sellAmount);
	inventory.horseCoins = (inventory.horseCoins || 0) + coinsEarned;
	await inventory.save();

	devLog(
		`/horsesell: ${interaction.user.tag} sold \`${sellAmount}x\` ${horseName(horseSlug)} for ${coinsEarned} coins. New balance: ${inventory.horseCoins} coins.`,
	).catch(async (error: unknown) =>
		handleCommandError(error, interaction),
	);
	return interaction.editReply(
		`You sold ${sellAmount > 1 ? `**${sellAmount}x** ` : 'your '}**${horseName(horseSlug)}** for **${coinsEarned}** 🪙 Horse Coin${coinsEarned === 1 ? '' : 's'}!`,
	);
}

export async function execute(
	interaction: ChatInputCommandInteraction,
) {
	await interaction.deferReply();
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const UserHorses = mongoose.model<IUserHorses>('UserHorses');
	const horseSlug = interaction.options.getString('horse');
	const amount = interaction.options.getInteger('amount') ?? 1;
	const isTop = horseSlug === 'top';
	const isBottom = horseSlug === 'bottom';
	const isTopBottom = isTop || isBottom;

	const inventory = await UserHorses.findOne({
		userId: interaction.user.id,
	});
	if (!inventory) {
		return interaction.editReply({
			content: `You don't have any horses!`,
		});
	}

	// Top/bottom bulk sell
	if (isTopBottom) {
		return topOrBottomBulkSell(
			interaction,
			inventory,
			isTop,
			amount,
		);
	}

	// Single horse type sell
	if (!horseSlug || !HORSE_VALUES[horseSlug]) {
		return interaction.editReply({
			content: `That isn't a valid horse.`,
		});
	}

	return standardHorseSell(
		interaction,
		inventory,
		horseSlug,
		amount,
	);
}
