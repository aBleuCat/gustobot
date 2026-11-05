import { immutConfig } from "../config.js";
import {
	DailyStatsArchive,
	UserStats,
	type IDailyStatsArchive,
	type ITimeframeStats,
} from "../models.js";

function sumNumericStats(
	totals: Record<string, unknown>,
	stats: Record<string, unknown>,
	maximumKeys: readonly string[] = [],
	minimumKeys: readonly string[] = [],
): void {
	for (const [key, total] of Object.entries(totals)) {
		const stat = stats[key];
		if (typeof total === "number" && typeof stat === "number") {
			if (maximumKeys.includes(key)) {
				totals[key] = Math.max(total, stat);
			} else if (minimumKeys.includes(key)) {
				totals[key] = Math.min(total, stat);
			} else {
				totals[key] = total + stat;
			}
		}
	}
}

function createEmptyStats(): IDailyStatsArchive["stats"] {
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
			horsesGiven: 0,
			horsesRecieved: 0,
			totalHorseValueGiven: 0,
			totalHorseValueRecieved: 0,
		},
		leaderboard: { highestPosition: null },
		races: { racesParticipated: 0, racesWon: 0, racesLost: 0 },
		trades: {
			tradesCompleted: 0,
			totalDollarsGiven: 0,
			totalDollarsRecieved: 0,
			totalCoinsGiven: 0,
			totalCoinsRecieved: 0,
		},
	};
}

function addDailyStats(
	totals: IDailyStatsArchive["stats"],
	stats: ITimeframeStats,
): void {
	sumNumericStats(
		totals.gambling,
		stats.gambling,
		["highestWin", "highestGamblingStreak"],
		["highestLoss"],
	);
	sumNumericStats(totals.spawns, stats.spawns, [
		"highestValueSpawn",
	]);
	sumNumericStats(totals.begs, stats.begs);
	sumNumericStats(totals.donations, stats.donations, [
		"highestGiven",
		"highestRecieved",
	]);
	sumNumericStats(totals.races, stats.races);
	sumNumericStats(totals.trades, stats.trades);
}

let lastCheckedDay: string | undefined;
let isUpdateInProgress = false;

async function archivePreviousDay(): Promise<void> {
	const now = Temporal.Now.zonedDateTimeISO("America/New_York");
	const today = now.toPlainDate();
	const todayStart = now.startOfDay().toInstant().epochMilliseconds;
	const nextDayStart = now
		.startOfDay()
		.add({ days: 1 })
		.startOfDay()
		.toInstant().epochMilliseconds;
	const day = today.subtract({ days: 1 }).toString();

	const existingArchive = await DailyStatsArchive.exists({ day });
	if (existingArchive) return;

	const users = await UserStats.find({
		"daily.nextRefresh": {
			$gte: new Date(todayStart),
			$lt: new Date(nextDayStart),
		},
	})
		.select({ daily: 1, _id: 0 })
		.lean();

	const stats = createEmptyStats();
	for (const user of users) addDailyStats(stats, user.daily);

	await DailyStatsArchive.updateOne(
		{ day },
		{ $setOnInsert: { day, stats } },
		{ upsert: true },
	);

	console.log(
		`[DailyStatsArchive] Archived ${day} stats for ${users.length} users.`,
	);
}

async function checkForNewDay(): Promise<void> {
	if (isUpdateInProgress) return;
	isUpdateInProgress = true;
	try {
		const currentDay = Temporal.Now.zonedDateTimeISO(
			"America/New_York",
		)
			.toPlainDate()
			.toString();
		if (lastCheckedDay === currentDay) return;

		await archivePreviousDay();
		lastCheckedDay = currentDay;
	} finally {
		isUpdateInProgress = false;
	}
}

export function startDailyStatsArchiveTask(): void {
	console.log("[DailyStatsArchive] Task initialized.");
	void checkForNewDay().catch((error: unknown) => {
		console.error(
			"[DailyStatsArchive] Initial archive check failed:",
			error,
		);
	});

	setInterval(() => {
		void checkForNewDay().catch((error: unknown) => {
			console.error(
				"[DailyStatsArchive] Archive check failed:",
				error,
			);
		});
	}, 30 * immutConfig.SECOND_MS);
}
