import { ChatInputCommandInteraction } from 'discord.js';
import { config } from '../../lib/config';
import { conditionHorse } from '../../lib/helpers/horseFuncs';
import { devLog } from '../../lib/helpers/devLog';
import { HOUSE_USER_ID, COMMON_HORSE, STREAK_HORSE, STREAK_REQUIRED, SAFE_LENGTH, ROLL_FACTOR, MIN_ROLL } from './constants';
import { updateStreak } from './streaks';
import { horseName, getClosestHorse, calculateCoinCostPerHorse, getOrCreateInventory } from './inventory';
import { formatBulkSummary } from './format';
import { HorseValues } from './types';

const HORSE_VALUES: HorseValues = require('../../horses.json');

export async function handleBulkGamble(
    interaction: ChatInputCommandInteraction,
    inventory: any,
    UserHorses: any,
    initialHorsesToGamble: string[],
    isTest: boolean,
    isTop: boolean,
    isBottom: boolean,
) {
    const isTopBottom = isTop || isBottom;
    devLog(`/horsegamble: Starting bulk gamble for user ${interaction.user.id} | count=${initialHorsesToGamble.length}`, 'micro');

    let totalWins = 0, totalLosses = 0, totalCompleteLosses = 0, totalNoChange = 0;
    let coinsSpent = 0;
    let netValueChange = 0;
    const gained = new Map<string, number>();
    const costPerHorse = calculateCoinCostPerHorse(isTest ? 100 : (inventory.horseCoins || 0));

    const now = Date.now();
    let houseInv: any = isTest ? null : await getOrCreateInventory(UserHorses, HOUSE_USER_ID);

    for (const slug of initialHorsesToGamble) {
        if (!isTest && (inventory.horses.get(slug) || 0) <= 0) continue;

        if (!isTest) {
            inventory.horseCoins -= costPerHorse;
            coinsSpent += costPerHorse;
            if (inventory.horseCoins < 0 && Math.random() < config.CONFISCATE_CHANCE) {
                inventory.horses.set(slug, inventory.horses.get(slug) - 1);
                houseInv.horses.set(slug, (houseInv.horses.get(slug) || 0) + 1);
                totalCompleteLosses++;
                continue;
            }
        } else {
            coinsSpent += costPerHorse;
        }

        const startValue = HORSE_VALUES[slug].value;
        const change = Math.floor(Math.random() * ROLL_FACTOR) + MIN_ROLL;
        const targetValue = startValue + change;
        const effectiveLossThresh = config.LOSS_THRESHOLD - Math.max(0, (startValue - 100) / 10);

        if (change < effectiveLossThresh) {
            if (!isTest) {
                inventory.horses.set(slug, inventory.horses.get(slug) - 1);
                houseInv.horses.set(slug, (houseInv.horses.get(slug) || 0) + 1);
            }
            netValueChange -= startValue;
            totalCompleteLosses++;
        } else {
            const closestSlug = getClosestHorse(targetValue);
            const endValue = HORSE_VALUES[closestSlug].value;
            const actualDiff = endValue - startValue;

            if (!isTest) {
                inventory.horses.set(slug, inventory.horses.get(slug) - 1);
            }

            if (closestSlug === slug) {
                if (!isTest) {
                    inventory.horses.set(slug, (inventory.horses.get(slug) || 0) + 1);
                }
                totalNoChange++;
            } else {
                if (!isTest) {
                    inventory.horses.set(closestSlug, (inventory.horses.get(closestSlug) || 0) + 1);
                    const commonTransfer = Math.round(Math.abs(actualDiff) / 25);
                    if (commonTransfer > 0) {
                        if (actualDiff < 0) {
                            houseInv.horses.set(COMMON_HORSE, (houseInv.horses.get(COMMON_HORSE) || 0) + commonTransfer);
                        } else if (actualDiff > 0) {
                            const houseCurrentCommon = houseInv.horses.get(COMMON_HORSE) || 0;
                            houseInv.horses.set(COMMON_HORSE, Math.max(0, houseCurrentCommon - commonTransfer));
                        }
                    }
                }
                gained.set(closestSlug, (gained.get(closestSlug) || 0) + 1);
                netValueChange += actualDiff;
                if (actualDiff >= 0) totalWins++;
                else totalLosses++;
            }
        }
    }

    let bulkStreakMsg = '';
    if (!isTest) {
        devLog(`/horsegamble: Bulk gamble completed for user ${interaction.user.id} | wins=${totalWins} losses=${totalLosses} completeLosses=${totalCompleteLosses} netChange=${netValueChange}`, 'micro');
        inventory.lastGamble = now;
        const { newStreak, awarded } = updateStreak(interaction.user.id, netValueChange > 0);
        if (awarded) {
            inventory.horses.set(STREAK_HORSE, (inventory.horses.get(STREAK_HORSE) || 0) + 1);
            bulkStreakMsg = `\n🏆 **GAMBLING STREAK!** You won ${STREAK_REQUIRED} in a row and received a **${horseName(STREAK_HORSE)}**!`;
            devLog(`/horsegamble: Streak horse awarded to user ${interaction.user.id}`);
        } else if (netValueChange > 0) {
            bulkStreakMsg = `\n*(Win streak: ${newStreak}/${STREAK_REQUIRED})*`;
        }
        await houseInv.save();
        await inventory.save();
        devLog(`/horsegamble: Bulk gamble inventory saved for user ${interaction.user.id}`, 'micro');
    }

    const coinsRemaining: number | string = isTest ? '(test)' : (inventory.horseCoins || 0);

    // Compute net horse changes
    const initialHorseCounts = new Map<string, number>();
    for (const slug of initialHorsesToGamble) {
        initialHorseCounts.set(slug, (initialHorseCounts.get(slug) || 0) + 1);
    }

    const finalHorseCounts = new Map<string, number>();
    if (!isTest) {
        for (const [slug, cnt] of (inventory.horses as Map<string, number>).entries()) {
            if (cnt > 0) finalHorseCounts.set(slug, cnt);
        }
    } else {
        for (const [slug, gainedCount] of gained.entries()) {
            finalHorseCounts.set(slug, (finalHorseCounts.get(slug) || 0) + gainedCount);
        }
    }

    const horseChangeMap = new Map<string, number>();
    const allHorseSlugs = new Set([...initialHorseCounts.keys(), ...finalHorseCounts.keys()]);
    for (const slug of allHorseSlugs) {
        const before = initialHorseCounts.get(slug) || 0;
        const after = finalHorseCounts.get(slug) || 0;
        const diff = after - before;
        if (diff !== 0) horseChangeMap.set(slug, diff);
    }

    let changeLines = '';
    for (const [slug, diff] of [...horseChangeMap.entries()].sort((a, b) => {
        const av = Math.abs(b[1]) - Math.abs(a[1]);
        if (av !== 0) return av;
        return (HORSE_VALUES[b[0]]?.value ?? 0) - (HORSE_VALUES[a[0]]?.value ?? 0);
    })) {
        const value = HORSE_VALUES[slug]?.value || 0;
        const before = initialHorseCounts.get(slug) || 0;
        const after = finalHorseCounts.get(slug) || 0;
        const prefix = diff > 0 ? (before === 0 ? '!' : '+') : '-';
        const total = value * diff;
        const totalSign = total > 0 ? '+' : '';
        changeLines += `\n${prefix}${Math.abs(diff)} ${horseName(slug)} ($${value} * ${prefix}${Math.abs(diff)} = ${totalSign}$${total}) (${before} -> ${after})`;
    }

    const remainingLine = (!isTopBottom && !isTest)
        ? `, remaining: ${inventory.horses.get(initialHorsesToGamble[0]) || 0}`
        : '';

    const horseLabel = isTop ? 'top horses' : isBottom ? 'bottom horses' : horseName(initialHorsesToGamble[0]);

    const summary = formatBulkSummary({
        totalWins, totalLosses, totalCompleteLosses, totalNoChange,
        netValueChange, coinsSpent, coinsRemaining,
        horseLabel, changeLines, remainingLine, isTest,
    });

    if (summary.length > SAFE_LENGTH) {
        await interaction.editReply({
            content: `Output too large, see attached file.` + bulkStreakMsg,
            files: [{ attachment: Buffer.from(summary, 'utf8'), name: 'gamble.txt' }],
        });
    } else {
        await interaction.editReply({ content: summary + bulkStreakMsg });
    }

    if (!isTest) conditionHorse(inventory, interaction.channel).catch((e: Error) => console.error('conditionHorse error:', e));
}