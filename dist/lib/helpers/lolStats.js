import { LolStats } from '../models.js';
export async function updateLolStatsDB() {
    let stats = await LolStats.findOne({ id: 'global_stats' });
    if (!stats)
        stats = new LolStats({ id: 'global_stats' });
    const now = new Date();
    const todayStr = now.toDateString();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNum = Math.ceil((((now.getTime() - startOfYear.getTime()) / 86400000) + startOfYear.getDay() + 1) / 7);
    if (stats.lastDay !== todayStr) {
        stats.daily = 0;
        stats.lastDay = todayStr;
    }
    if (stats.lastWeek !== weekNum) {
        stats.weekly = 0;
        stats.lastWeek = weekNum;
    }
    stats.allTime += 1;
    stats.weekly += 1;
    stats.daily += 1;
    stats.lastTimestamp = Date.now();
    await stats.save();
    return stats;
}
//# sourceMappingURL=lolStats.js.map