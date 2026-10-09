import { type AutocompleteInteraction, type ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandSubcommandBuilder } from "discord.js";
import rawHorseValues from "../../data/horses.json" with { type: "json" };
import { castAsHorseData } from "../../type-utils.js";
import { config } from "../../lib/config.js"
import type { Horse } from "../../types.js";

const HORSE_VALUES = castAsHorseData(rawHorseValues);
const HORSE_ENTRIES = Object.entries(HORSE_VALUES);
const {
	ANTIINFLATOR,
	SPAWN_COEFFICIENT,
	COMMON_SELL_PRICE,
	TRAINING_PRICE_CONSTANT,
	TRAINING_PRICE_DIVISOR,
	MIN_ROLL,
	MAX_ROLL,
	LOSS_THRESHOLD,
} = config;

const EMBED_FIELD_LIMIT = 1024;
// Room kept for the "...and N more" line when the outcome list is truncated
const OVERFLOW_LINE_RESERVE = 40;
const ROLL_COUNT = MAX_ROLL - MIN_ROLL + 1;

const GAMBLE_POOL = HORSE_ENTRIES.filter(
	// eslint-disable-next-line unicorn/no-non-function-verb-prefix
	([, { comp, getByGamble }]) => comp !== false && getByGamble !== false,
);

type GambleOutcome = {
	name: string;
	chance: number;
}

type GambleOdds = {
	lossChance: number;
	outcomes: GambleOutcome[];
	averageReturn: number;
}

function rankBy(slug: string, metric: (horse: Horse) => number): number {
	return (
		1 + HORSE_ENTRIES
			.toSorted(([, a], [, b]) => metric(b) - metric(a))
			.findIndex(([horseSlug]) => horseSlug === slug)
	);
}

function closestGambleHorses(targetValue: number): Array<[string, Horse]> {
	let minDiff = Infinity;
	let closest: Array<[string, Horse]> = [];
	for (const entry of GAMBLE_POOL) {
		const diff = Math.abs(entry[1].value - targetValue);
		if (diff < minDiff) {
			minDiff = diff;
			closest = [entry];
		} else if (diff === minDiff) {
			closest.push(entry);
		}
	}

	return closest;
}

/**
 Exact odds of gambling a horse worth `startValue`, mirroring the roll logic in
 horse-gamble.ts. Ignores coin cost and confiscation (those depend on the user and the time).
 Average return is the expected net value change per gamble, a complete loss counting as -startValue.
 */
function computeGambleOdds(startValue: number): GambleOdds {
	const lossThreshold = LOSS_THRESHOLD - Math.max(0, (startValue - 100) / 10);
	const rollChance = 1 / ROLL_COUNT;
	const chances = new Map<string, GambleOutcome>();
	let lossChance = 0;
	let averageReturn = 0;

	for (let change = MIN_ROLL; change <= MAX_ROLL; change++) {
		if (change < lossThreshold) {
			lossChance += rollChance;
			averageReturn -= startValue * rollChance;
			continue;
		}

		const closest = closestGambleHorses(startValue + change);
		if (closest.length === 0) continue;
		const share = rollChance / closest.length;
		for (const [slug, horse] of closest) {
			const existing = chances.get(slug);
			if (existing) {
				existing.chance += share;
			} else {
				chances.set(slug, { name: horse.name, chance: share });
			}

			averageReturn += (horse.value - startValue) * share;
		}
	}

	return {
		lossChance,
		outcomes: chances.values().toArray().toSorted((a, b) => b.chance - a.chance),
		averageReturn,
	};
}

function formatPercent(chance: number): string {
	const percent = chance * 100;
	return percent > 0 && percent < 0.01 ? "<0.01%" : `${percent.toFixed(2)}%`;
}

function formatSignedDollars(amount: number): string {
	return `${amount < 0 ? "-" : "+"}$${Math.abs(amount).toFixed(2)}`;
}

function describeGamble(startValue: number): string {
	const { lossChance, outcomes, averageReturn } = computeGambleOdds(startValue);
	const footer = `Complete Loss: ${formatPercent(lossChance)}\nAverage Return: ${formatSignedDollars(averageReturn)}`;

	let budget = EMBED_FIELD_LIMIT - footer.length - 1;
	const lines: string[] = [];
	let hiddenCount = 0;
	let hiddenChance = 0;
	for (const { name, chance } of outcomes) {
		const line = `${name}: ${formatPercent(chance)}`;
		if (hiddenCount === 0 && line.length + 1 + OVERFLOW_LINE_RESERVE <= budget) {
			lines.push(line);
			budget -= line.length + 1;
		} else {
			hiddenCount++;
			hiddenChance += chance;
		}
	}

	if (hiddenCount > 0) {
		lines.push(`...and ${hiddenCount} more: ${formatPercent(hiddenChance)}`);
	}

	return [...lines, footer].join("\n");
}

export const data = new SlashCommandSubcommandBuilder()
	.setName("info")
	.setDescription("Get the info for a specific breed of horse")
	.addStringOption((option) =>
		option
			.setName("breed")
			.setDescription("The breed you want info on")
			.setRequired(true)
			.setAutocomplete(true)
	)

export function autocomplete(
	interaction: AutocompleteInteraction
) {
	const focused = interaction.options.getFocused().toLowerCase();
	const choices = HORSE_ENTRIES
		.filter(([slug, {name}]) => slug.includes(focused) || name.toLowerCase().includes(focused))
		.slice(0, 25)
		.map(([slug, {name}]) => ({ name, value: slug }));
	return choices;
}

export async function execute(
	interaction: ChatInputCommandInteraction
) {
	const breedOption = interaction.options.getString("breed");
	if (!breedOption) {
		return interaction.reply({
			content: "Couldn't figure out what you put for 'breed'",
			flags: [MessageFlags.Ephemeral],
		});
	}

	let breed = HORSE_ENTRIES.find(([slug]) => slug === breedOption);
	breed ??= HORSE_ENTRIES.find(([, {name}]) => name.toLowerCase() === breedOption.toLowerCase());

	if (!breed) {
		return interaction.reply({
			content: "That horse does not seem to exist",
			flags: [MessageFlags.Ephemeral],
		});
	}

	// eslint-disable-next-line unicorn/no-non-function-verb-prefix
	const [slug, {name, value, rarity, speed, link, thumbnail, comp, spawn, getByGamble}] = breed;

	const totalHorses = HORSE_ENTRIES.length;

	const valuePosition = rankBy(slug, (horse) => horse.value);
	const sellPrice = (value / 25) * COMMON_SELL_PRICE;
	const valueDescription = {
		name: "Value",
		value: `$${value} (#${valuePosition} of ${totalHorses})\nWould sell for 🪙 ${sellPrice} Horse Coin with \`horses sell\`\n-# \`horses sell\` purposefully gives less horse coin than horses are worth`,
	};

	const obtainmentDescription = {
		name: "Obtainment",
		value: `Spawnable: ${spawn === false ? "No" : "Yes"}\nBy Gamble: ${getByGamble === false ? "No" : "Yes"}\nCompletion: ${comp === false ? "No" : "Yes"}`,
	}

	const effectiveRarity = 1 / (rarity * SPAWN_COEFFICIENT * ANTIINFLATOR);
	const rarityPosition = rankBy(slug, (horse) => horse.rarity);
	const rarityDescription = {
		name: "Rarity",
		value: `Stat: ${rarity} (#${rarityPosition} of ${totalHorses})\nEffective: ${effectiveRarity.toFixed(4)}\nAverage 1 in ${(1 / effectiveRarity).toFixed(0)} messages\n${rarity / 25}x rarer than commons`,
	}

	const trainingPrice =
		Math.floor(value / TRAINING_PRICE_DIVISOR) +
		TRAINING_PRICE_CONSTANT;
	const speedUpperBound = speed * 1.1;
	const speedLowerBound = speed * 0.9;
	const speedPosition = rankBy(slug, (horse) => horse.speed);
	const raceDescription = {
		name: "Racing",
		value: `Base Speed: ${speed} (#${speedPosition} of ${totalHorses})\nWhen one of these are trained, they may have a speed between ${speedLowerBound.toFixed(0)} and ${speedUpperBound.toFixed(0)}\nTraining Cost: ${trainingPrice}`,
	}

	const gambleDescription = {
		name: "Gambling",
		value: describeGamble(value),
	};

	const otherDescription = {
		name: "Other",
		value: `Internal Slug: ${slug}`,
	}

	const embed = new EmbedBuilder()
		.setTitle(name)
		.setColor("#8B4513") // Chestnut
		.setThumbnail(thumbnail ?? link)
		.addFields(valueDescription, obtainmentDescription, rarityDescription, raceDescription, gambleDescription, otherDescription)
	if (thumbnail === undefined && /\.gif\/?$/iv.test(link)) {
		embed.setFooter({ text: "The horse thumbnail may not load" });
	}

	return interaction.reply({ embeds: [embed] });
}
