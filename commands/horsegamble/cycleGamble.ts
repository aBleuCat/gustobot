import { ChatInputCommandInteraction } from 'discord.js';
import { config } from '../../lib/config';
import { conditionHorse } from '../../lib/helpers/horseFuncs';
import { devLog } from '../../lib/helpers/devLog';
import { HOUSE_USER_ID, STREAK_HORSE, STREAK_REQUIRED, SAFE_LENGTH } from './constants';
import { updateStreak } from './streaks';
import { horseName, calculateCoinCostPerHorse, getOrCreateInventory } from './inventory';
import { simulateBulkPass } from './simulate';
import { formatCycleLog } from './format';
import { HorseValues } from './types';

const HORSE_VALUES: HorseValues = require('../../horses.json');

export async function handleCycleGamble(
    interaction: ChatInputCommandInteraction,
    inventory: any,
    UserHorses: any,
    initialHorsesToGamble: string[],
    cycles: number,
    bankAbove: number | null,
    isTest: boolean,
    isTop: boolean,
    isBottom: boolean,
    horseSlug: string,
) {
    devLog(`/horsegamble: Starting cycle mode for user ${interaction.user.id} | cycles=${cycles} bankAbove=${bankAbove}`, 'micro');

    const staticInventory = new Map<string, number>();
    const cycleInventory = new Map<string, number>();

    if (isTest) {
        for (const slug of initialHorsesToGamble) {
            cycleInventory.set(slug, (cycleInventory.get(slug) || 0) + 1);
        }
    } else {
        for (const [slug, count] of (inventory.horses as Map<string, number>).entries()) {
            staticInventory.set(slug, count);
        }
        for (const slug of initialHorsesToGamble) {
            if ((staticInventory.get(slug) || 0) <= 0) continue;
            staticInventory.set(slug, staticInventory.get(slug)! - 1);
            if (staticInventory.get(slug) === 0) staticInventory.delete(slug);
            cycleInventory.set(slug, (cycleInventory.get(slug) || 0) + 1);
        }
    }

    const virtualInv = {
        horses: cycleInventory,
        horseCoins: isTest ? 9999 : (inventory.horseCoins || 0),
    };

    const bankedHorses = new Map<string, number>();
    let bankingCoinDebt = 0;
    let totalCoinsSpentOnBanking = 0;

    let cycleHorses = [...initialHorsesToGamble];
    const cycleLogBlocks: string[] = [];
    let haltedEarly = false;
    let haltReason = '';

    for (let c = 1; c <= cycles; c++) {
        devLog(`/horsegamble: Cycle ${c}/${cycles} | horses=${cycleHorses.length} coins=${virtualInv.horseCoins}`, 'micro');

        const currentCostPerHorse = calculateCoinCostPerHorse(virtualInv.horseCoins);

        if (virtualInv.horseCoins < (config.MIN_CYCLE_COIN_COUNT ?? 0)) {
            haltedEarly = true;
            haltReason = `Halted before cycle ${c}: coins (${virtualInv.horseCoins}) fell below MIN_CYCLE_COIN_COUNT (${config.MIN_CYCLE_COIN_COUNT ?? 0}).`;
            devLog(`/horsegamble: Cycle halted due to low coins: ${haltReason}`, 'micro');
            break;
        }
        if (cycleHorses.length === 0) {
            haltedEarly = true;
            haltReason = `Halted before cycle ${c}: no horses left to gamble.`;
            devLog(`/horsegamble: Cycle halted due to no horses`, 'micro');
            break;
        }

        const bankedThisCycle: string[] = [];
        if (bankAbove !== null) {
            const toGamble: string[] = [];
            for (const slug of cycleHorses) {
                const val = HORSE_VALUES[slug]?.value ?? 0;
                if (val > bankAbove && (virtualInv.horses.get(slug) || 0) > 0) {
                    virtualInv.horses.set(slug, virtualInv.horses.get(slug)! - 1);
                    bankedHorses.set(slug, (bankedHorses.get(slug) || 0) + 1);
                    bankingCoinDebt += 0.3;
                    bankedThisCycle.push(slug);
                } else {
                    toGamble.push(slug);
                }
            }
            cycleHorses = toGamble;

            const newWholeCoins = Math.ceil(bankingCoinDebt) - totalCoinsSpentOnBanking;
            if (newWholeCoins > 0) {
                virtualInv.horseCoins -= newWholeCoins;
                totalCoinsSpentOnBanking += newWholeCoins;
            }
        }

        if (cycleHorses.length === 0) {
            cycleLogBlocks.push(`**Cycle #${c}**\nAll horses were banked — nothing to gamble.\nHorse Coins Remaining: ${virtualInv.horseCoins}`);
            break;
        }

        const result = simulateBulkPass(cycleHorses, virtualInv, currentCostPerHorse);
        devLog(`/horsegamble: Cycle ${c} results: wins=${result.wins} losses=${result.losses} completeLosses=${result.completeLosses} netChange=${result.netValueChange}`, 'micro');

        const uniqueHorseTypes = [...new Set(cycleHorses)];
        const horseLabel = uniqueHorseTypes.length === 1
            ? `${cycleHorses.length} ${horseName(uniqueHorseTypes[0])}`
            : `${cycleHorses.length} horses`;

        cycleLogBlocks.push(formatCycleLog(c, horseLabel, result, bankedThisCycle, virtualInv.horseCoins));

        const nextCycleHorses: string[] = [];
        for (const [slug, cnt] of result.cycleOutput.entries()) {
            if (!HORSE_VALUES[slug] || cnt <= 0) continue;
            for (let i = 0; i < cnt; i++) nextCycleHorses.push(slug);
        }
        cycleHorses = nextCycleHorses;
    }

    // Diff original vs final for DB updates
    const originalMap = new Map<string, number>();
    for (const s of initialHorsesToGamble) originalMap.set(s, (originalMap.get(s) || 0) + 1);

    const finalActiveMap = new Map<string, number>();
    for (const [s, cnt] of virtualInv.horses.entries()) {
        if (HORSE_VALUES[s] && cnt > 0) finalActiveMap.set(s, cnt);
    }

    const lostToHouse = new Map<string, number>();
    for (const [s, origCnt] of originalMap.entries()) {
        const lost = origCnt - (finalActiveMap.get(s) || 0);
        if (lost > 0) lostToHouse.set(s, lost);
    }

    const gainedFromHouse = new Map<string, number>();
    for (const [s, finalCnt] of finalActiveMap.entries()) {
        const gained = finalCnt - (originalMap.get(s) || 0);
        if (gained > 0) gainedFromHouse.set(s, gained);
    }

    const originalValue = [...originalMap.entries()].reduce((sum, [s, cnt]) => sum + (HORSE_VALUES[s]?.value ?? 0) * cnt, 0);
    const finalActiveValue = [...finalActiveMap.entries()].reduce((sum, [s, cnt]) => sum + (HORSE_VALUES[s]?.value ?? 0) * cnt, 0);
    const bankedValue = [...bankedHorses.entries()].reduce((sum, [s, cnt]) => sum + (HORSE_VALUES[s]?.value ?? 0) * cnt, 0);
    const finalValue = finalActiveValue + bankedValue;
    const totalNetChange = finalValue - originalValue;
    const totalGambledCount = initialHorsesToGamble.length;
    const totalAvgChange = totalGambledCount > 0 ? Math.round(totalNetChange / totalGambledCount) : 0;
    const totalCoinsSpent = isTest ? 0 : ((inventory.horseCoins || 0) - virtualInv.horseCoins);

    if (!isTest) {
        devLog(`/horsegamble: Cycle mode finalized for user ${interaction.user.id} | totalNetChange=${totalNetChange} finalCoins=${virtualInv.horseCoins}`, 'micro');
        inventory.horses = new Map(staticInventory);
        for (const [slug, cnt] of virtualInv.horses.entries()) {
            inventory.horses.set(slug, (inventory.horses.get(slug) || 0) + cnt);
        }
        for (const [slug, cnt] of bankedHorses.entries()) {
            inventory.horses.set(slug, (inventory.horses.get(slug) || 0) + cnt);
        }
        inventory.horseCoins = virtualInv.horseCoins;
        inventory.lastGamble = Date.now();

        const houseInv = await getOrCreateInventory(UserHorses, HOUSE_USER_ID);
        for (const [slug, cnt] of lostToHouse.entries()) {
            houseInv.horses.set(slug, (houseInv.horses.get(slug) || 0) + cnt);
        }
        for (const [slug, cnt] of gainedFromHouse.entries()) {
            houseInv.horses.set(slug, Math.max(0, (houseInv.horses.get(slug) || 0) - cnt));
        }
        await houseInv.save();
        await inventory.save();
        devLog(`/horsegamble: Cycle mode inventory saved for user ${interaction.user.id}`, 'micro');
    }

    let cycleStreakMsg = '';
    if (!isTest) {
        const { newStreak: cycleStreak, awarded: cycleAwarded } = updateStreak(interaction.user.id, totalNetChange > 0);
        if (cycleAwarded) {
            inventory.horses.set(STREAK_HORSE, (inventory.horses.get(STREAK_HORSE) || 0) + 1);
            await inventory.save();
            cycleStreakMsg = `🏆 **GAMBLING STREAK!** You won ${STREAK_REQUIRED} in a row and received a **${horseName(STREAK_HORSE)}**!`;
            devLog(`/horsegamble: Streak horse awarded to user ${interaction.user.id}`);
        } else if (totalNetChange > 0) {
            cycleStreakMsg = `*(Win streak: ${cycleStreak}/${STREAK_REQUIRED})*`;
        }
    }

    const initialHorseLabel = isTop ? 'top horses' : isBottom ? 'bottom horses' : horseName(horseSlug);
    const finalLines: string[] = [
        `🎲 **Final Gambling Results after ${cycleLogBlocks.length} Cycle${cycleLogBlocks.length !== 1 ? 's' : ''}**`,
        `Gambled ${totalGambledCount} horses (started as ${initialHorsesToGamble.length} ${initialHorseLabel})`,
        `Starting Value: $${originalValue}`,
        `Final Active Value: $${finalActiveValue}`,
        `Banked Value: $${bankedValue}`,
        `Total Value (active + banked): $${finalValue}`,
        `Net Change (active + banked): $${totalNetChange >= 0 ? '+' : ''}${totalNetChange} ($${totalAvgChange >= 0 ? '+' : ''}${totalAvgChange} avg. per horse)`,
        `Final Horses:`,
    ];

    const finalGrouped = new Map<string, number>();
    [...finalActiveMap.entries()]
        .flatMap(([s, cnt]) => Array(cnt).fill(s))
        .sort((a, b) => (HORSE_VALUES[b]?.value ?? 0) - (HORSE_VALUES[a]?.value ?? 0))
        .forEach((s: string) => finalGrouped.set(s, (finalGrouped.get(s) || 0) + 1));
    for (const [s, cnt] of finalGrouped.entries()) {
        finalLines.push(`${cnt} ${horseName(s)} ($${HORSE_VALUES[s]?.value})`);
    }
    if (finalGrouped.size === 0) finalLines.push(`*(none)*`);

    if (bankedHorses.size > 0) {
        const bankedSorted = [...bankedHorses.entries()]
            .sort((a, b) => (HORSE_VALUES[b[0]]?.value ?? 0) - (HORSE_VALUES[a[0]]?.value ?? 0));
        for (const [s, cnt] of bankedSorted) {
            finalLines.push(`Horses Banked: ${cnt} ${horseName(s)} (-${totalCoinsSpentOnBanking} Horse Coin${totalCoinsSpentOnBanking !== 1 ? 's' : ''})`);
        }
    }

    finalLines.push(`Horse Coins Spent: ${isTest ? '(test)' : totalCoinsSpent}`);
    finalLines.push(`Horse Coins Remaining: ${isTest ? '(test)' : virtualInv.horseCoins}`);
    if (haltedEarly) finalLines.push(`⚠️ ${haltReason}`);
    if (isTest) finalLines.push(`*(test mode — no horses or coins spent)*`);
    if (cycleStreakMsg) finalLines.push(cycleStreakMsg);

    const fileContent = [
        `// gamblelog.js generated at ${new Date().toISOString()}`,
        '',
        ...cycleLogBlocks,
        '',
        '=== FINAL SUMMARY ===',
        finalLines.join('\n'),
    ].join('\n\n');

    const finalText = finalLines.join('\n');
    const trueFinalLines = finalText.length > SAFE_LENGTH
        ? finalLines.slice(0, 10).concat(['... (full in attached file)']).concat(finalLines.slice(-10))
        : finalLines;

    await interaction.editReply({
        content: trueFinalLines.join('\n'),
        files: [{ attachment: Buffer.from(fileContent, 'utf8'), name: 'gamblelog.js' }],
    });

    if (!isTest) conditionHorse(inventory, interaction.channel).catch((e: Error) => console.error('conditionHorse error:', e));
}