import {
	SlashCommandSubcommandBuilder,
	type ChatInputCommandInteraction,
} from "discord.js";
import { config } from "../../lib/config.js";
import rawHorseValues from "../../data/horses.json" with { type: "json" };
import { UserHorses, type IUserHorses } from "../../lib/models.js";
import { castAsHorseData } from "../../type-utils.js";
import type { HorseData } from "../../types.js";

const horseDataCatalog = castAsHorseData(rawHorseValues);

function calculateMedian(values: number[]) {
	if (values.length === 0) return 0;
	const sorted = [...values].toSorted((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 0) {
		const lower = sorted[middle - 1] ?? 0;
		const upper = sorted[middle] ?? 0;
		return (lower + upper) / 2;
	}

	return sorted[middle] ?? 0;
}

function calculateHorseWealth(user: IUserHorses, horseCatalog: HorseData) {
	let horseWealth = 0;
	const horseEntries =
		user.horses instanceof Map
			? user.horses.entries()
			: Object.entries(user.horses ?? {});

	for (const [slug, count] of horseEntries) {
		const numericCount =
			typeof count === "number" ? count : Number(count);
		if (typeof numericCount !== "number" || numericCount <= 0) {
			continue;
		}

		horseWealth += (horseCatalog[slug]?.value ?? 0) * numericCount;
	}

	return horseWealth;
}

function formatStatValue(value: number) {
	return value.toLocaleString(undefined, {
		maximumFractionDigits: 2,
	});
}

export const data = new SlashCommandSubcommandBuilder()
	.setName("probabilities")
	.setDescription("Check horse probabilities");

export async function execute(
	interaction: ChatInputCommandInteraction,
) {
	const calculateChance = (value: number) => {
		const denominator =
			value * config.SPAWN_COEFFICIENT * config.ANTIINFLATOR;
		return 1 / denominator;
	};

	const allUsers = await UserHorses.find({});
	const coinWealthValues: number[] = [];
	const horseWealthValues: number[] = [];

	for (const user of allUsers) {
		coinWealthValues.push(user.horseCoins ?? 0);

		if (user.horses) {
			horseWealthValues.push(calculateHorseWealth(user, horseDataCatalog));
		} else {
			horseWealthValues.push(0);
		}
	}

	let totalCoinWealth = 0;
	for (const value of coinWealthValues) {
		totalCoinWealth += value;
	}

	let totalHorseWealth = 0;
	for (const value of horseWealthValues) {
		totalHorseWealth += value;
	}

	const averageCoinWealth =
		coinWealthValues.length > 0
			? totalCoinWealth / coinWealthValues.length
			: 0;
	const averageHorseWealth =
		horseWealthValues.length > 0
			? totalHorseWealth / horseWealthValues.length
			: 0;
	const medianHorseWealth = calculateMedian(horseWealthValues);

	let totalRate = 0;

	const horseStats = Object.values(horseDataCatalog as Record<string, unknown>)
		.map((horse) => {
			const horseInfo = horse as {
				name: string;
				value?: number;
				spawn?: boolean;
			};
			const horseValue = horseInfo.value ?? 0;
			const chance = calculateChance(horseValue);
			const isSpawnable = horseInfo.spawn !== false;

			if (isSpawnable) {
				totalRate += chance;
			}

			return {
				name: horseInfo.name,
				val: horseValue,
				prob: (chance * 100).toFixed(5),
				msgFreq: Math.round(1 / chance).toLocaleString(),
				isSpawnable,
			};
		})
		.toSorted((a, b) => b.val - a.val);

	const statsLines = horseStats.map((s) => {
		const nameTag = s.isSpawnable
			? s.name
			: `[NOSPAWN] ${s.name}`;
		return `${nameTag.padEnd(35)} | ${s.prob}% | 1 in ${s.msgFreq}`;
	});

	const header = `Name                                | Prob       | Avg Messages\n${"-".repeat(70)}`;
	const footer = `\nAverage coin wealth: ${formatStatValue(averageCoinWealth)} coins\nMean horse wealth: ${formatStatValue(averageHorseWealth)} coins\nMedian horse wealth: ${formatStatValue(medianHorseWealth)} coins\n\nTotal chance for ANY horse: ${(totalRate * 100).toFixed(4)}%\nAverage 1 horse every ${Math.round(1 / totalRate)} messages.`;

	const fullTable = `\`\`\`\n${header}\n${statsLines.join("\n")}\n${footer}\n\`\`\``;

	return interaction.reply({ content: fullTable });
}
