import { EmbedBuilder } from "discord.js";
import type { ClientSession } from "mongoose";
import quests from "../../data/quests.js";
import {
	UserQuests,
	UserStats,
	type ITimeframeStats,
	type IUserQuests,
	type IUserStats,
} from "../models.js";

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
		catches: {
			totalCatches: 0,
			totalCatchValue: 0,
			highestCatchValue: 0,
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

function emptyTimeframe(nextRefresh: Date) {
	return { ...emptyStats(), nextRefresh };
}

function emptyQuestTimeframe(nextRefresh: Date): ITimeframeStats {
	return {
		...emptyStats(),
		nextRefresh,
		nextRefreshTemporal: Temporal.Instant.fromEpochMilliseconds(
			nextRefresh.getTime(),
		),
	};
}

const emptyAllTime = emptyStats();

type QuestType = "daily" | "weekly";
export type QuestNotificationPayload = { embeds: [EmbedBuilder] };

function getQuestStats(
	statsDocument: IUserStats | undefined,
	questType: QuestType,
	now: Date,
	nextRefresh: Date,
): ITimeframeStats {
	const stats = statsDocument?.[questType];
	return stats && stats.nextRefresh > now
		? stats
		: emptyQuestTimeframe(nextRefresh);
}

function createQuestNotification({
	questDocument,
	previousStats,
	updatedStats,
	now,
	nextDailyRefresh,
	nextWeeklyRefresh,
}: {
	questDocument: IUserQuests | undefined;
	previousStats: IUserStats | undefined;
	updatedStats: IUserStats | undefined;
	now: Date;
	nextDailyRefresh: Date;
	nextWeeklyRefresh: Date;
}): QuestNotificationPayload | undefined {
	if (!questDocument || !updatedStats) return undefined;

	const completedQuests: Array<{
		questType: QuestType;
		name: string;
		description: string;
	}> = [];
	for (const questType of ["daily", "weekly"] as const) {
		const timeframeQuests = questDocument[questType];
		if (timeframeQuests.nextRefresh <= now) continue;

		const nextRefresh =
			questType === "daily"
				? nextDailyRefresh
				: nextWeeklyRefresh;
		const before = getQuestStats(
			previousStats,
			questType,
			now,
			nextRefresh,
		);
		const after = getQuestStats(
			updatedStats,
			questType,
			now,
			nextRefresh,
		);
		for (const questName of timeframeQuests.unclaimed) {
			const quest = quests[questType][questName];
			if (
				quest &&
				!quest.isCompleted(before) &&
				quest.isCompleted(after)
			) {
				completedQuests.push({
					questType,
					name: quest.name,
					description: quest.description,
				});
			}
		}
	}

	if (completedQuests.length === 0) return undefined;

	const completedTypes = new Set(
		completedQuests.map(({ questType }) => questType),
	);
	const title =
		completedTypes.size > 1
			? "Daily/Weekly Quest Completed!"
			: `${completedTypes.has("daily") ? "Daily" : "Weekly"} Quest Completed!`;
	const questCommands = [...completedTypes]
		.map((questType) => `/quests ${questType}`)
		.join(" or ");

	return {
		embeds: [
			new EmbedBuilder()
				.setTitle(title)
				.setColor(0xa6_e3_a8)
				.setDescription(
					completedQuests
						.map(
							({ name, description }) =>
								`**${name}**\n${description}`,
						)
						.join("\n\n"),
				)
				.setFooter({
					text: `Use ${questCommands} to check.`,
				}),
		],
	};
}

function buildUpdatePipeline({
	userId,
	changes,
	now,
	freshDaily,
	freshWeekly,
}: {
	userId: string;
	changes: StatChanges;
	now: Date;
	freshDaily: ReturnType<typeof emptyTimeframe>;
	freshWeekly: ReturnType<typeof emptyTimeframe>;
}): Array<Record<string, unknown>> {
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

	const updateFields: Record<string, unknown> = {};
	for (const [path, amount] of Object.entries(
		changes.increments ?? {},
	)) {
		updateFields[`allTime.${path}`] = {
			$add: [{ $ifNull: [`$allTime.${path}`, 0] }, amount],
		};
		if (!changes.allTimeOnly) {
			for (const timeframe of ["daily", "weekly"] as const) {
				updateFields[`${timeframe}.${path}`] = {
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
		updateFields[`allTime.${path}`] = {
			$max: [{ $ifNull: [`$allTime.${path}`, 0] }, value],
		};
		if (!changes.allTimeOnly) {
			for (const timeframe of ["daily", "weekly"] as const) {
				updateFields[`${timeframe}.${path}`] = {
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
		updateFields[`allTime.${path}`] = {
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
				updateFields[`${timeframe}.${path}`] = {
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

	return [
		{ $set: update },
		...(Object.keys(updateFields).length > 0
			? [{ $set: updateFields }]
			: []),
	];
}

export async function recordUserStats(
	userId: string,
	changes: StatChanges,
	session?: ClientSession,
): Promise<QuestNotificationPayload | undefined> {
	const now = new Date();
	const nextDailyRefresh = getNextRefresh("daily");
	const nextWeeklyRefresh = getNextRefresh("weekly");
	const freshDaily = emptyTimeframe(nextDailyRefresh);
	const freshWeekly = emptyTimeframe(nextWeeklyRefresh);
	let previousStats: IUserStats | undefined;
	if (!changes.allTimeOnly) {
		previousStats =
			(await UserStats.findOne<IUserStats>({ userId }).session(
				session ?? null,
			)) ?? undefined;
	}

	const pipeline = buildUpdatePipeline({
		userId,
		changes,
		now,
		freshDaily,
		freshWeekly,
	});

	await UserStats.updateOne({ userId }, pipeline, {
		upsert: true,
		...(session && { session }),
	});

	if (changes.allTimeOnly) return undefined;

	const [updatedStats, questDocument] = await Promise.all([
		UserStats.findOne<IUserStats>({ userId }).session(
			session ?? null,
		),
		UserQuests.findOne<IUserQuests>({ userId }).session(
			session ?? null,
		),
	]);

	return createQuestNotification({
		questDocument: questDocument ?? undefined,
		previousStats,
		updatedStats: updatedStats ?? undefined,
		now,
		nextDailyRefresh,
		nextWeeklyRefresh,
	});
}

export async function recordUserStatsAndNotify(
	userId: string,
	changes: StatChanges,
	sendNotification: (
		payload: QuestNotificationPayload,
	) => Promise<unknown>,
	session?: ClientSession,
): Promise<void> {
	const payload = await recordUserStats(userId, changes, session);
	if (!payload) return;
	await sendNotification(payload);
}
