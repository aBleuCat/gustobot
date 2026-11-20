import process from "node:process";
import fs from "node:fs";
import rawHorseValues from "../src/data/horses.json" with { type: "json" };
import { config } from "../src/lib/config.js";
import { castAsHorseData } from "../src/type-utils.js";
import type { Horse } from "../src/types.js";

const horses = castAsHorseData(rawHorseValues);
const horseEntries = Object.entries<Horse>(horses);
const gamblePool = horseEntries.filter(
	([, horse]) =>
		horse.comp !== false && horse.getByGamble !== false,
);
const rollCount = config.MAX_ROLL - config.MIN_ROLL + 1;

type Outcome = {
	startingSlug: string;
	startingHorse: string;
	result: string;
	probability: string;
};

function getClosestHorses(
	targetValue: number,
): Array<[string, Horse]> {
	let minDifference = Infinity;
	let closest: Array<[string, Horse]> = [];

	for (const entry of gamblePool) {
		const difference = Math.abs(entry[1].value - targetValue);
		if (difference < minDifference) {
			minDifference = difference;
			closest = [entry];
		} else if (difference === minDifference) {
			closest.push(entry);
		}
	}

	return closest;
}

function getOutcomes(
	startingSlug: string,
	startingHorse: Horse,
): Outcome[] {
	const lossThreshold =
		config.LOSS_THRESHOLD -
		Math.max(0, (startingHorse.value - 100) / 10);
	const rollChance = 1 / rollCount;
	const probabilities = new Map<string, number>();

	for (
		let change = config.MIN_ROLL;
		change <= config.MAX_ROLL;
		change++
	) {
		if (change < lossThreshold) {
			probabilities.set(
				"Lost horse",
				(probabilities.get("Lost horse") ?? 0) + rollChance,
			);
			continue;
		}

		const closest = getClosestHorses(
			startingHorse.value + change,
		);
		if (closest.length === 0) {
			throw new Error(
				"No horses are eligible as gambling outcomes.",
			);
		}

		const chancePerHorse = rollChance / closest.length;
		for (const [resultSlug] of closest) {
			probabilities.set(
				resultSlug,
				(probabilities.get(resultSlug) ?? 0) + chancePerHorse,
			);
		}
	}

	const outcomeEntries: Array<[string, number]> = [];
	probabilities.forEach((chance, resultSlug) => {
		outcomeEntries.push([resultSlug, chance]);
	});

	const outcomes: Outcome[] = [];
	for (const [resultSlug, chance] of outcomeEntries) {
		outcomes.push({
			startingSlug,
			startingHorse: startingHorse.name,
			result:
				resultSlug === "Lost horse"
					? resultSlug
					: (horses[resultSlug]?.name ?? resultSlug),
			probability: `${(chance * 100).toFixed(4)}%`,
		});
	}

	return outcomes;
}

function main(): void {
	const input = process.argv.slice(2).join(" ").trim();
	if (!input) {
		throw new Error(
			"Usage: pnpm exec tsx thingies/horse-gamble-probabilities.ts <horse-slug|horse-name|all>",
		);
	}

	if (input.toLowerCase() === "all") {
		fs.writeFileSync(
			"./banana.json",
			JSON.stringify(
				horseEntries.flatMap(([slug, horse]) =>
					getOutcomes(slug, horse),
				),
				null,
				2,
			),
			"utf8",
		);
		return;
	}

	const selected = horseEntries.find(
		([slug, horse]) =>
			slug.toLowerCase() === input.toLowerCase() ||
			horse.name.toLowerCase() === input.toLowerCase(),
	);
	if (!selected) {
		throw new Error(
			`Unknown horse "${input}". Use "all" or a horse slug/name.`,
		);
	}

	console.table(getOutcomes(selected[0], selected[1]));
}

try {
	main();
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
}
