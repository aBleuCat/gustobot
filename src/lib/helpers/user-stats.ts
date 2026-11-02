import type { ClientSession } from "mongoose";
import { UserStats } from "../models.js";

type StatChanges = {
	increments?: Record<string, number>;
	maxima?: Record<string, number>;
	minima?: Record<string, number>;
	allTimeOnly?: boolean;
};

function getNextRefresh(questType: "daily" | "weekly"): Date {
	const now = Temporal.Now.zonedDateTimeISO("America/New_York");
	let daysToAdd =
		questType === "weekly" ? (7 - now.dayOfWeek) % 7 : 1;
	if (questType === "weekly" && daysToAdd === 0) daysToAdd = 7;

	return new Date(
		now
			.add({ days: daysToAdd })
			.with({ hour: 0, minute: 0, second: 0, millisecond: 0 })
			.epochMilliseconds,
	);
}

function emptyStats() {
	return {
		gambling: {
			totalGambles: 0,
			wins: 0,
			losses: 0,
			highestWin: 0,
			highestLoss: 0,
			highestGamblingStreak: 0,
			totalDollarsGambled: 0,
			totalDollarsWon: 0,
			totalDollarsLost: 0,
			totalCoinsGambled: 0,
			totalCoinsWon: 0,
			totalCoinsLost: 0,
		},
		spawns: {
			totalSpawns: 0,
			totalSpawnsValue: 0,
			highestValueSpawn: 0,
			messagesCounted: 0,
		},
		begs: { begs: 0 },
		donations: {
			totalGiven: 0,
			totalRecieved: 0,
			highestGiven: 0,
			highestRecieved: 0,
		},
		leaderboard: { highestPosition: null },
		races: { racesWon: 0, racesLost: 0 },
		trades: {
			tradesCompleted: 0,
			totalDollarsGiven: 0,
			totalDollarsRecieved: 0,
			totalCoinsGiven: 0,
			totalCoinsRecieved: 0,
		},
	};
}

function emptyTimeframe(nextRefresh: Date) {
	return { ...emptyStats(), nextRefresh };
}

const emptyAllTime = emptyStats();

export async function recordUserStats(
	userId: string,
	changes: StatChanges,
	session?: ClientSession,
): Promise<void> {
	const now = new Date();
	const nextDailyRefresh = getNextRefresh("daily");
	const nextWeeklyRefresh = getNextRefresh("weekly");
	const freshDaily = emptyTimeframe(nextDailyRefresh);
	const freshWeekly = emptyTimeframe(nextWeeklyRefresh);

	const resetIfExpired = (path: string) => ({
		$or: [
			{ $eq: [{ $type: path }, "missing"] },
			{ $lte: [path, now] },
		],
	});

	const update: Record<string, unknown> = {
		userId: { $ifNull: ["$userId", userId] },
		allTime: { $ifNull: ["$allTime", emptyAllTime] },
		daily: {
			$cond: [
				resetIfExpired("$daily.nextRefresh"),
				freshDaily,
				{ $ifNull: ["$daily", freshDaily] },
			],
		},
		weekly: {
			$cond: [
				resetIfExpired("$weekly.nextRefresh"),
				freshWeekly,
				{ $ifNull: ["$weekly", freshWeekly] },
			],
		},
	};

	const setChanges: Record<string, unknown> = {};
	for (const [path, amount] of Object.entries(
		changes.increments ?? {},
	)) {
		setChanges[`allTime.${path}`] = {
			$add: [{ $ifNull: [`$allTime.${path}`, 0] }, amount],
		};
		if (!changes.allTimeOnly) {
			for (const timeframe of ["daily", "weekly"] as const) {
				setChanges[`${timeframe}.${path}`] = {
					$add: [
						{ $ifNull: [`$${timeframe}.${path}`, 0] },
						amount,
					],
				};
			}
		}
	}

	for (const [path, value] of Object.entries(
		changes.maxima ?? {},
	)) {
		setChanges[`allTime.${path}`] = {
			$max: [{ $ifNull: [`$allTime.${path}`, 0] }, value],
		};
		if (!changes.allTimeOnly) {
			for (const timeframe of ["daily", "weekly"] as const) {
				setChanges[`${timeframe}.${path}`] = {
					$max: [
						{ $ifNull: [`$${timeframe}.${path}`, 0] },
						value,
					],
				};
			}
		}
	}

	for (const [path, value] of Object.entries(
		changes.minima ?? {},
	)) {
		setChanges[`allTime.${path}`] = {
			$cond: [
				{
					$or: [
						{ $eq: [`$allTime.${path}`, null] },
						{ $lt: [value, `$allTime.${path}`] },
					],
				},
				value,
				`$allTime.${path}`,
			],
		};
		if (!changes.allTimeOnly) {
			for (const timeframe of ["daily", "weekly"] as const) {
				setChanges[`${timeframe}.${path}`] = {
					$cond: [
						{
							$or: [
								{
									$eq: [
										`$${timeframe}.${path}`,
										null,
									],
								},
								{
									$lt: [
										value,
										`$${timeframe}.${path}`,
									],
								},
							],
						},
						value,
						`$${timeframe}.${path}`,
					],
				};
			}
		}
	}

	const pipeline: Record<string, unknown>[] = [{ $set: update }];
	if (Object.keys(setChanges).length > 0) {
		pipeline.push({ $set: setChanges });
	}

	await UserStats.updateOne({ userId }, pipeline, {
		upsert: true,
		...(session ? { session } : {}),
	});
}
