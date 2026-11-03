import { calculateHorseLeaderboards } from "../helpers/horse-leaderboard.js";
import { recordUserStats } from "../helpers/user-stats.js";
import { immutConfig } from "../config.js";

let updateInProgress = false;

async function updateLeaderboardPositions(): Promise<void> {
	if (updateInProgress) {
		console.warn(
			"[HorseLeaderboardStats] Skipping overlapping update.",
		);
		return;
	}

	updateInProgress = true;
	try {
		const { worth } = await calculateHorseLeaderboards();
		for (let start = 0; start < worth.length; start += 100) {
			const batch = worth.slice(start, start + 100);
			await Promise.all(
				batch.map((entry, offset) =>
					recordUserStats(entry.userId, {
						minima: {
							"leaderboard.highestPosition":
								start + offset + 1,
						},
						allTimeOnly: true,
					}),
				),
			);
		}
		console.log(
			`[HorseLeaderboardStats] Updated positions for ${worth.length} users.`,
		);
	} finally {
		updateInProgress = false;
	}
}

export function startHorseLeaderboardStatsTask(): void {
	console.log("[HorseLeaderboardStats] Task initialized.");
	void updateLeaderboardPositions().catch((error: unknown) => {
		console.error(
			"[HorseLeaderboardStats] Initial leaderboard update failed:",
			error,
		);
	});

	setInterval(() => {
		void updateLeaderboardPositions().catch((error: unknown) => {
			console.error(
				"[HorseLeaderboardStats] Leaderboard update failed:",
				error,
			);
		});
	}, 15 * immutConfig.MINUTE_MS);
}
