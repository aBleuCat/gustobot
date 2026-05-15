import {LolStats} from '../models.js';

export async function updateLolStatsDB() {
	let stats = await LolStats.findOne({id: 'global_stats'});
	stats ??= new LolStats({id: 'global_stats'});

	const now = new Date();
	const todayString = now.toDateString();
	const startOfYear = new Date(now.getFullYear(), 0, 1);
	const weekNumber = Math.ceil(
		((now.getTime() - startOfYear.getTime()) / 86_400_000 +
			startOfYear.getDay() +
			1) /
			7,
	);

	if (stats.lastDay !== todayString) {
		stats.daily = 0;
		stats.lastDay = todayString;
	}

	if (stats.lastWeek !== weekNumber) {
		stats.weekly = 0;
		stats.lastWeek = weekNumber;
	}

	stats.allTime += 1;
	stats.weekly += 1;
	stats.daily += 1;
	stats.lastTimestamp = Date.now();

	await stats.save();
	return stats;
}
