import fs from 'fs';
import { STREAKS_PATH, STREAK_REQUIRED } from './constants';
import { StreakMap, StreakResult } from './types';

export function loadStreaks(): StreakMap {
    try {
        return JSON.parse(fs.readFileSync(STREAKS_PATH, 'utf8'));
    } catch {
        return {};
    }
}

export function saveStreaks(streaks: StreakMap): void {
    try {
        fs.writeFileSync(STREAKS_PATH, JSON.stringify(streaks, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to save gamble_streaks.json:', e);
    }
}

/**
 * Update the streak for a user after a gamble outcome.
 * isNetWin = true if net value change > 0.
 * Returns { newStreak, awarded } — awarded=true means user hit STREAK_REQUIRED.
 */
export function updateStreak(userId: string, isNetWin: boolean): StreakResult {
    const streaks = loadStreaks();
    if (!isNetWin) {
        streaks[userId] = 0;
        saveStreaks(streaks);
        return { newStreak: 0, awarded: false };
    }
    streaks[userId] = (streaks[userId] || 0) + 1;
    const newStreak = streaks[userId];
    let awarded = false;
    if (newStreak >= STREAK_REQUIRED) {
        streaks[userId] = 0;
        awarded = true;
    }
    saveStreaks(streaks);
    return { newStreak, awarded };
}