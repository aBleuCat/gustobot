import rawHorseValues from "../../data/horses.json" with { type: "json" };
import { castAsHorseData } from "../../type-utils.js";
import { trainedHorseValue } from "./horse-funcs.js";
import { TrainedHorses, UserHorses } from "../models.js";

export type HorseLeaderboardEntry = {
	userId: string;
	worth: number;
	horseCoins: number;
	completion: number;
};

export type HorseLeaderboards = {
	worth: HorseLeaderboardEntry[];
	completion: HorseLeaderboardEntry[];
	coins: HorseLeaderboardEntry[];
};

const HORSE_VALUES = castAsHorseData(rawHorseValues);

export function horseItemValue(slug: string): number {
	return HORSE_VALUES[slug]?.value ?? 0;
}

export async function calculateHorseLeaderboards(): Promise<HorseLeaderboards> {
	const [allUsers, allTrained] = await Promise.all([
		UserHorses.find({}, { userId: 1, horses: 1, horseCoins: 1 }),
		TrainedHorses.find({}),
	]);
	const trainedByUser = new Map<string, typeof allTrained>();
	for (const horse of allTrained) {
		const userHorses = trainedByUser.get(horse.ownerId) ?? [];
		userHorses.push(horse);
		trainedByUser.set(horse.ownerId, userHorses);
	}

	const totalPossibleItems = Math.max(
		1,
		Object.values(HORSE_VALUES).filter(
			(horse) => horse.comp !== false,
		).length,
	);
	const entries = allUsers.map((user) => {
		let worth = 0;
		let unique = 0;
		const seenBreedIds = new Set<string>();
		for (const [slug, count] of user.horses) {
			if (count <= 0) continue;

			const horse = HORSE_VALUES[slug];
			if (!horse) continue;
			worth += horse.value * count;
			if (horse.comp !== false && !seenBreedIds.has(slug)) {
				seenBreedIds.add(slug);
				unique++;
			}
		}

		for (const horse of trainedByUser.get(user.userId) ?? []) {
			worth += trainedHorseValue(horse.breed);
			if (
				HORSE_VALUES[horse.breed]?.comp !== false &&
				!seenBreedIds.has(horse.breed)
			) {
				seenBreedIds.add(horse.breed);
				unique++;
			}
		}

		return {
			userId: user.userId,
			worth,
			horseCoins: user.horseCoins || 0,
			completion: Math.round(
				(unique / totalPossibleItems) * 100,
			),
		};
	});

	const sortBy = (
		selector: (entry: HorseLeaderboardEntry) => number,
	) =>
		entries.toSorted(
			(a, b) =>
				selector(b) - selector(a) ||
				a.userId.localeCompare(b.userId),
		);

	return {
		worth: sortBy((entry) => entry.worth),
		completion: sortBy((entry) => entry.completion),
		coins: sortBy((entry) => entry.horseCoins),
	};
}
