import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { config } from '../../lib/config';
import { conditionHorse } from '../../lib/helpers/horseFuncs';
import { devLog } from '../../lib/helpers/devLog';
import { HOUSE_USER_ID, COMMON_HORSE, STREAK_HORSE, STREAK_REQUIRED, ROLL_FACTOR, MIN_ROLL } from './constants';
import { updateStreak } from './streaks';
import { horseName, getClosestHorse, calculateCoinCostPerHorse, getOrCreateInventory } from './inventory';
import { HorseValues } from './types';

const HORSE_VALUES: HorseValues = require('../../horses.json');

export async function handleHorseCoinGamble(
    interaction: ChatInputCommandInteraction,
    inventory: any,
    count: number,
    isTest: boolean,
) {
    devLog(`/horsegamble: Starting horse coin gamble for user ${interaction.user.id} | available=${isTest ? 'test' : inventory?.horseCoins}`);
    const available = isTest ? Infinity : (inventory.horseCoins || 0);

    if (!isTest && available < 2) {
        return interaction.editReply({ content: `You need **2 Horse Coins** to gamble a Horse Coin!` });
    }

    const gamblesCount = count === 0 ? Math.floor(available / 2) : count;
    if (gamblesCount <= 0) {
        return interaction.editReply({ content: `You need at least **2 Horse Coins** to gamble.` });
    }

    if (gamblesCount === 1) {
        const winAmount = Math.floor(Math.random() * 5);
        devLog(`/horsegamble: Single coin gamble for user ${interaction.user.id} | win=${winAmount} change=${winAmount - 2}`, 'micro');
        if (!isTest) {
            inventory.horseCoins = (inventory.horseCoins - 2) + winAmount;
            await inventory.save();
            devLog(`/horsegamble: Saved user ${interaction.user.id} coin balance: ${inventory.horseCoins}`, 'micro');
        }
        const testTag = isTest ? ' *(test — no coins spent)*' : '';
        return interaction.editReply({
            content:
                `**Horse Coin Gamble**\n\n` +
                '```patch\n' +
                `- 2 🪙 → +${winAmount} 🪙${testTag}\n` +
                '```',
        });
    }

    let coinsDelta = 0, wins = 0, losses = 0;
    for (let i = 0; i < gamblesCount; i++) {
        const winAmount = Math.floor(Math.random() * 5);
        coinsDelta += (winAmount - 2);
        if (winAmount >= 2) wins++; else losses++;
    }
    devLog(`/horsegamble: Bulk coin gamble for user ${interaction.user.id} | gamblesCount=${gamblesCount} wins=${wins} losses=${losses} delta=${coinsDelta}`);
    if (!isTest) {
        inventory.horseCoins = (inventory.horseCoins || 0) + coinsDelta;
        await inventory.save();
        devLog(`/horsegamble: Saved user ${interaction.user.id} bulk coin balance: ${inventory.horseCoins}`);
    }
    const testTag = isTest ? '\n(test mode — no coins spent)' : '';
    return interaction.editReply({
        content:
            `**Horse Coin Gamble**\n\n` +
            '```patch\n' +
            `- Gambled: ${gamblesCount} 🪙\n` +
            `+ Wins:    ${wins}\n` +
            `- Losses:  ${losses}\n` +
            `= Net:     ${coinsDelta >= 0 ? '+' : ''}${coinsDelta} 🪙\n` +
            '```' +
            testTag,
    });
}

export async function handleSingleGamble(
    interaction: ChatInputCommandInteraction,
    inventory: any,
    UserHorses: any,
    slug: string,
    isTest: boolean,
) {
    const costPerHorse = calculateCoinCostPerHorse(isTest ? 100 : (inventory.horseCoins || 0));
    devLog(`/horsegamble: Single gamble for user ${interaction.user.id} | horse=${slug} costPerHorse=${costPerHorse}`);

    if (!isTest) {
        inventory.horseCoins -= costPerHorse;
        if (inventory.horseCoins < 0 && Math.random() < config.CONFISCATE_CHANCE) {
            devLog(`/horsegamble: Confiscation triggered for user ${interaction.user.id} | horse=${slug} debt=${inventory.horseCoins}`);
            inventory.horses.set(slug, inventory.horses.get(slug) - 1);
            const houseInv = await getOrCreateInventory(UserHorses, HOUSE_USER_ID);
            houseInv.horses.set(slug, (houseInv.horses.get(slug) || 0) + 1);
            await houseInv.save();
            await inventory.save();
            return interaction.editReply(`🚔 You gambled into debt and the **police confiscated your ${horseName(slug)}**!`);
        }
    }

    const now = Date.now();
    const lastGamble = isTest ? 0 : (inventory.lastGamble || 0);
    let frenzyMessage = '';

    if (!isTest && now - lastGamble < config.FRENZY_THRESHOLD_MS) {
        if (Math.random() < config.FRENZY_CHANCE) {
            const ownedHorses: Array<{ slug: string; value: number }> = [];
            for (const [s, hCount] of (inventory.horses as Map<string, number>).entries()) {
                if (hCount > 0 && HORSE_VALUES[s]) {
                    const availableCount = (s === slug) ? hCount - 1 : hCount;
                    for (let i = 0; i < availableCount; i++) {
                        ownedHorses.push({ slug: s, value: HORSE_VALUES[s].value });
                    }
                }
            }
            ownedHorses.sort((a, b) => a.value - b.value);
            const victims = ownedHorses.slice(0, 2);
            if (victims.length > 0) {
                frenzyMessage = `\n\n🔥 **GAMBLING FRENZY!** You got too excited! You accidentally put ${victims.length} more horses into the pit:`;
                for (const victim of victims) {
                    inventory.horses.set(victim.slug, inventory.horses.get(victim.slug) - 1);
                    const fChange = Math.floor(Math.random() * ROLL_FACTOR) + MIN_ROLL;
                    const fTarget = victim.value + fChange;
                    const effectiveLossThresh = config.LOSS_THRESHOLD - Math.max(0, (victim.value - 100) / 10);
                    if (fChange < effectiveLossThresh) {
                        const frenzyHouseInv = await getOrCreateInventory(UserHorses, HOUSE_USER_ID);
                        frenzyHouseInv.horses.set(victim.slug, (frenzyHouseInv.horses.get(victim.slug) || 0) + 1);
                        await frenzyHouseInv.save();
                        frenzyMessage += `\n* Your **${horseName(victim.slug)}** ran away in the confusion!`;
                    } else {
                        const fClosest = getClosestHorse(fTarget);
                        inventory.horses.set(fClosest, (inventory.horses.get(fClosest) || 0) + 1);
                        frenzyMessage += `\n* Your **${horseName(victim.slug)}** was traded for a **${horseName(fClosest)}**.`;
                    }
                }
            }
        }
    }

    const startValue = HORSE_VALUES[slug].value;
    const change = Math.floor(Math.random() * ROLL_FACTOR) + MIN_ROLL;
    const targetValue = startValue + change;
    const effectiveLossThresh = config.LOSS_THRESHOLD - Math.max(0, (startValue - 100) / 10);

    if (change < effectiveLossThresh) {
        devLog(`/horsegamble: Single gamble loss for user ${interaction.user.id} | horse=${slug} startValue=${startValue} change=${change}`, 'micro');
        if (!isTest) {
            inventory.horses.set(slug, inventory.horses.get(slug) - 1);
            const houseInv = await getOrCreateInventory(UserHorses, HOUSE_USER_ID);
            houseInv.horses.set(slug, (houseInv.horses.get(slug) || 0) + 1);
            await houseInv.save();
            await inventory.save();
        }
        const testTag = isTest ? ' *(test)*' : '';
        if (!isTest) updateStreak(interaction.user.id, false);
        if (!isTest) conditionHorse(inventory, interaction.channel).catch((e: Error) => console.error('conditionHorse error:', e));
        return interaction.editReply(`I told you gambling is bad! You lost your **${horseName(slug)}**!${frenzyMessage}${testTag}`);
    }

    const closestSlug = getClosestHorse(targetValue);
    const endValue = HORSE_VALUES[closestSlug].value;
    const actualDiff = endValue - startValue;
    devLog(`/horsegamble: Single gamble win for user ${interaction.user.id} | from=${slug}(${startValue}) to=${closestSlug}(${endValue}) diff=${actualDiff}`, 'micro');

    if (!isTest) {
        inventory.horses.set(slug, inventory.horses.get(slug) - 1);
        inventory.horses.set(closestSlug, (inventory.horses.get(closestSlug) || 0) + 1);

        const commonTransfer = Math.round(Math.abs(actualDiff) / 25);
        if (commonTransfer > 0) {
            const houseInv = await getOrCreateInventory(UserHorses, HOUSE_USER_ID);
            if (actualDiff < 0) {
                houseInv.horses.set(COMMON_HORSE, (houseInv.horses.get(COMMON_HORSE) || 0) + commonTransfer);
                devLog(`/horsegamble: House gained ${commonTransfer} common horses from user ${interaction.user.id}`, 'micro');
            } else if (actualDiff > 0) {
                const houseCurrentCommon = houseInv.horses.get(COMMON_HORSE) || 0;
                houseInv.horses.set(COMMON_HORSE, Math.max(0, houseCurrentCommon - commonTransfer));
                devLog(`/horsegamble: House lost ${commonTransfer} common horses to user ${interaction.user.id}`, 'micro');
            }
            await houseInv.save();
        }

        inventory.lastGamble = Date.now();
        await inventory.save();
    }

    let outcomeMsg = '';
    if (closestSlug === slug) {
        outcomeMsg = `The gamble resulted in no change ($0). You kept your **${horseName(slug)}**.`;
    } else {
        const resultText = actualDiff >= 0 ? `won +${actualDiff}` : `lost ${Math.abs(actualDiff)}`;
        outcomeMsg = `You gambled your **${horseName(slug)}** (${startValue}) and ${resultText}. You got a **${horseName(closestSlug)}** (${endValue})!`;
    }
    if (isTest) outcomeMsg += ' *(test)*';

    let singleStreakMsg = '';
    if (!isTest) {
        const isNetWin = actualDiff > 0;
        const { newStreak, awarded } = updateStreak(interaction.user.id, isNetWin);
        if (awarded) {
            inventory.horses.set(STREAK_HORSE, (inventory.horses.get(STREAK_HORSE) || 0) + 1);
            await inventory.save();
            singleStreakMsg = `\n\n🏆 **GAMBLING STREAK!** You won ${STREAK_REQUIRED} in a row and received a **${horseName(STREAK_HORSE)}**!`;
            devLog(`/horsegamble: Streak horse awarded to user ${interaction.user.id}`);
        } else if (isNetWin) {
            singleStreakMsg = `\n*(Win streak: ${newStreak}/${STREAK_REQUIRED})*`;
        }
    }

    if (!isTest) conditionHorse(inventory, interaction.channel).catch((e: Error) => console.error('conditionHorse error:', e));
    return interaction.editReply(outcomeMsg + frenzyMessage + singleStreakMsg);
}