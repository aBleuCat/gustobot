import { BulkPassResult, HorseValues } from './types';
import { horseName } from './inventory';
import horsesRaw from '../../horses.json';
const HORSE_VALUES: Record<string, any> = horsesRaw;

/**
 * Format a single per-cycle log block.
 */
export function formatCycleLog(
    cycleNum: number,
    horseLabel: string,
    result: BulkPassResult,
    bankedThisCycle: string[],
    coinsAfter: number,
): string {
    const { wins, losses, completeLosses, noChange, netValueChange, coinsSpent, gained } = result;
    const totalGambled = wins + losses + completeLosses + noChange;
    const avgChange = totalGambled > 0 ? Math.round(netValueChange / totalGambled) : 0;

    let gainedLines = '';
    for (const [slug, cnt] of [...gained.entries()].sort((a, b) => b[1] - a[1])) {
        gainedLines += `\n+${cnt} ${horseName(slug)} ($${HORSE_VALUES[slug]?.value})`;
    }

    let bankedLines = '';
    if (bankedThisCycle.length > 0) {
        const bankedMap = new Map<string, number>();
        for (const slug of bankedThisCycle) bankedMap.set(slug, (bankedMap.get(slug) || 0) + 1);
        for (const [slug, cnt] of bankedMap.entries()) {
            bankedLines += `\n! Banked: ${cnt} ${horseName(slug)} (-${cnt} 🪙)`;
        }
    }

    return (
        `**Cycle #${cycleNum}**\n` +
        '```patch\n' +
        `- Gambled: ${totalGambled} ${horseLabel}\n` +
        `+ Wins:    ${wins}\n` +
        `- Losses:  ${losses}\n` +
        `- Complete Losses: ${completeLosses}\n` +
        `= No Change: ${noChange}\n` +
        `= Net:      ${netValueChange >= 0 ? '+' : ''}$${netValueChange} (${avgChange >= 0 ? '+' : ''}$${avgChange}/horse)\n` +
        `- Coins Spent: ${coinsSpent}\n` +
        `+ Coins Left:  ${coinsAfter}\n` +
        '```' +
        (gainedLines ? '\n**Gained:**' + gainedLines : '') +
        (bankedLines ? '\n' + bankedLines : '')
    );
}

export function formatBulkSummary(params: {
    totalWins: number;
    totalLosses: number;
    totalCompleteLosses: number;
    totalNoChange: number;
    netValueChange: number;
    coinsSpent: number;
    coinsRemaining: number | string;
    horseLabel: string;
    changeLines: string;
    remainingLine: string;
    isTest: boolean;
}): string {
    const {
        totalWins, totalLosses, totalCompleteLosses, totalNoChange,
        netValueChange, coinsSpent, coinsRemaining,
        horseLabel, changeLines, remainingLine, isTest,
    } = params;

    const totalGambled = totalWins + totalLosses + totalCompleteLosses + totalNoChange;
    const avgChange = totalGambled > 0 ? Math.round(netValueChange / totalGambled) : 0;
    const testTag = isTest ? '\n*(test mode — no horses or coins spent)*' : '';

    return [
        `**Horse Gamble Results**`,
        '```patch',
        `- Gambled: ${totalGambled} ${horseLabel}`,
        `+ Wins:    ${totalWins}`,
        `- Losses:  ${totalLosses}`,
        `- Complete Losses: ${totalCompleteLosses}`,
        `= No Change: ${totalNoChange}${remainingLine}`,
        `${netValueChange >= 0 ? '+' : '-'} Net Value: ${netValueChange >= 0 ? '+' : ''}$${netValueChange} (${avgChange >= 0 ? '+' : ''}$${avgChange}/horse)`,
        `- Coins Spent: ${coinsSpent}`,
        `+ Coins Left:  ${coinsRemaining}`,
        (changeLines.trim() ? changeLines : ''),
        '```',
        testTag || '',
    ].filter(Boolean).join('\n');
}