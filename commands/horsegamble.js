const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const HORSE_VALUES = require('../horses.json');
const mongoose = require('mongoose');
const { config } = require('../lib/config');

const HOUSE_USER_ID = '1469509600561729710';
const COMMON_HORSE = 'common_horse';
const ADMIN_IDS = ['934290747623096381', '853658523786412063'];

function horseName(slug) {
    return HORSE_VALUES[slug]?.name ?? slug;
}

function getClosestHorse(targetValue) {
    let minDiff = Infinity;
    let candidates = [];
    for (const [slug, data] of Object.entries(HORSE_VALUES)) {
        if (data.comp === false) continue;
        const diff = Math.abs(data.value - targetValue);
        if (diff < minDiff) { minDiff = diff; candidates = [slug]; }
        else if (diff === minDiff) { candidates.push(slug); }
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
}

function normalizeHorseMap(inventory) {
    if (!inventory) return inventory;
    if (inventory.horses instanceof Map) return inventory;
    const source = inventory.horses && typeof inventory.horses === 'object' ? inventory.horses : {};
    inventory.horses = new Map(Object.entries(source));
    if (typeof inventory.markModified === 'function') inventory.markModified('horses');
    return inventory;
}

async function getOrCreateInventory(UserHorses, userId) {
    let inv = await UserHorses.findOne({ userId });
    if (!inv) inv = new UserHorses({ userId, horses: new Map(), horseCoins: 0 });
    return normalizeHorseMap(inv);
}

function getSortedHorseList(inventory, sortDir = 'asc') {
    const list = [];
    for (const [slug, count] of inventory.horses.entries()) {
        if (count > 0 && HORSE_VALUES[slug]) {
            for (let i = 0; i < count; i++) {
                list.push({ slug, value: HORSE_VALUES[slug].value });
            }
        }
    }
    list.sort((a, b) => sortDir === 'asc' ? a.value - b.value : b.value - a.value);
    return list;
}

/**
 * Simulate one bulk gamble pass over an array of slugs.
 * Mutates virtualInv in place. Does NOT touch the DB.
 */
function simulateBulkPass(slugsToGamble, virtualInv) {
    let wins = 0, losses = 0, completeLosses = 0, noChange = 0;
    let netValueChange = 0, coinsSpent = 0;
    const gained = new Map();

    for (const slug of slugsToGamble) {
        if ((virtualInv.horses.get(slug) || 0) <= 0) continue;

        virtualInv.horseCoins -= 1;
        coinsSpent += 1;

        if (virtualInv.horseCoins < 0 && Math.random() < config.CONFISCATE_CHANCE) {
            virtualInv.horses.set(slug, virtualInv.horses.get(slug) - 1);
            completeLosses++;
            continue;
        }

        const startValue = HORSE_VALUES[slug].value;
        const change = Math.floor(Math.random() * 201) - 100;
        const targetValue = startValue + change;
        const effectivelossthresh = config.LOSS_THRESHOLD - Math.max(0, (startValue - 100) / 10);

        if (change < effectivelossthresh) {
            virtualInv.horses.set(slug, virtualInv.horses.get(slug) - 1);
            netValueChange -= startValue;
            completeLosses++;
        } else {
            const closestSlug = getClosestHorse(targetValue);
            const endValue = HORSE_VALUES[closestSlug].value;
            const actualDiff = endValue - startValue;

            virtualInv.horses.set(slug, virtualInv.horses.get(slug) - 1);

            if (closestSlug === slug) {
                virtualInv.horses.set(slug, (virtualInv.horses.get(slug) || 0) + 1);
                noChange++;
            } else {
                virtualInv.horses.set(closestSlug, (virtualInv.horses.get(closestSlug) || 0) + 1);
                gained.set(closestSlug, (gained.get(closestSlug) || 0) + 1);
                netValueChange += actualDiff;
                if (actualDiff >= 0) wins++;
                else losses++;
            }
        }
    }

    return { wins, losses, completeLosses, noChange, netValueChange, coinsSpent, gained };
}

/**
 * Format a single per-cycle log block.
 */
function formatCycleLog(cycleNum, horseLabel, result, bankedThisCycle, coinsAfter) {
    const { wins, losses, completeLosses, noChange, netValueChange, coinsSpent, gained } = result;
    const totalGambled = wins + losses + completeLosses + noChange;
    const avgChange = totalGambled > 0 ? Math.round(netValueChange / totalGambled) : 0;

    const lines = [];
    lines.push(`**Cycle #${cycleNum}**`);
    lines.push(`Gambled ${totalGambled} ${horseLabel}: ${wins} wins, ${losses} losses, ${completeLosses} complete losses, ${noChange} no-changes`);
    lines.push(`Net Change: $${netValueChange >= 0 ? '+' : ''}${netValueChange} ($${avgChange >= 0 ? '+' : ''}${avgChange} avg. per horse)`);

    for (const [slug, cnt] of [...gained.entries()].sort((a, b) => b[1] - a[1])) {
        lines.push(`+${cnt} ${horseName(slug)} ($${HORSE_VALUES[slug]?.value})`);
    }

    if (bankedThisCycle.length > 0) {
        const bankedMap = new Map();
        for (const slug of bankedThisCycle) bankedMap.set(slug, (bankedMap.get(slug) || 0) + 1);
        for (const [slug, cnt] of bankedMap.entries()) {
            lines.push(`Horses Banked: ${cnt} ${horseName(slug)} (-${cnt} Horse Coin${cnt !== 1 ? 's' : ''})`);
        }
    }

    lines.push(`Horse Coins Spent: ${coinsSpent}`);
    lines.push(`Horse Coins Remaining: ${coinsAfter}`);

    return lines.join('\n');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('horsegamble')
        .setDescription('Play the hand of fate and gamble a horse!')
        .addStringOption(option =>
            option.setName('horse')
                .setDescription('The horse to gamble, "Horse Coin", "top", or "bottom".')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addIntegerOption(option =>
            option.setName('count')
                .setDescription('Number of gamblings (1-100, or 0 for all). For top/bottom: 0 = gamble all.')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(100)
        )
        .addIntegerOption(option =>
            option.setName('cycles')
                .setDescription('Number of times to re-gamble the resulting horses (2-20).')
                .setRequired(false)
                .setMinValue(2)
                .setMaxValue(20)
        )
        .addIntegerOption(option =>
            option.setName('bankhorses')
                .setDescription('Protect horses valued above this amount. -0.3 coins banked.')
                .setRequired(false)
                .setMinValue(0)
        )
        .addBooleanOption(option =>
            option.setName('test')
                .setDescription('(Admin only) Simulate gambles without spending horses.')
                .setRequired(false)
        ),

    async autocomplete(interaction) {
        try {
            const UserHorses = mongoose.model('UserHorses');
            const focused = interaction.options.getFocused().toLowerCase();
            const inventory = normalizeHorseMap(await UserHorses.findOne({ userId: interaction.user.id }));

            const choices = [
                { name: '📈 top — gamble most valuable horses', value: 'top' },
                { name: '📉 bottom — gamble least valuable horses', value: 'bottom' },
            ];

            if ((inventory?.horseCoins || 0) >= 2) {
                choices.push({ name: '🪙 Horse Coin', value: 'horse_coin' });
            }

            if (inventory?.horses) {
                for (const [slug, count] of inventory.horses.entries()) {
                    if (count > 0 && HORSE_VALUES[slug]) {
                        choices.push({ name: `${horseName(slug)} (x${count})`, value: slug });
                    }
                }
            }

            const filtered = choices
                .filter(c => c.name.toLowerCase().includes(focused))
                .slice(0, 25);

            await interaction.respond(filtered);
        } catch (err) {
            console.error('horsegamble autocomplete error:', err);
            try { await interaction.respond([]); } catch {}
        }
    },

    async execute(interaction) {
        const UserHorses = mongoose.model('UserHorses');
        const horseSlug = interaction.options.getString('horse').trim().toLowerCase();
        let count = interaction.options.getInteger('count') ?? 1;
        const cycles = interaction.options.getInteger('cycles') ?? null;
        const bankAbove = interaction.options.getInteger('bankhorses') ?? null;
        const isTest = interaction.options.getBoolean('test') ?? false;
        const isHorseCoin = horseSlug === 'horse_coin';
        const isTop = horseSlug === 'top';
        const isBottom = horseSlug === 'bottom';
        const isTopBottom = isTop || isBottom;
        const isAdmin = ADMIN_IDS.includes(interaction.user.id);
        const isCycleMode = cycles !== null && cycles >= 2;

        if (isTest && !isAdmin) {
            return interaction.reply({ content: `You don't have permission to use test mode.`, flags: [MessageFlags.Ephemeral] });
        }

        if (isCycleMode && isHorseCoin) {
            return interaction.reply({ content: `Cycle mode cannot be used with Horse Coin gambling. Yet...`, flags: [MessageFlags.Ephemeral] });
        }

        if (!isHorseCoin && !isTopBottom && !HORSE_VALUES[horseSlug]) {
            const match = Object.keys(HORSE_VALUES).find(k =>
                HORSE_VALUES[k].name.toLowerCase() === horseSlug ||
                k.toLowerCase() === horseSlug
            );
            const suggestion = match ? ` Did you mean **${horseName(match)}**?` : '';
            return interaction.reply({ content: `**${horseSlug}** isn't a valid horse.${suggestion}`, flags: [MessageFlags.Ephemeral] });
        }

        let inventory = isTest ? null : normalizeHorseMap(await UserHorses.findOne({ userId: interaction.user.id }));

        if (!isTest) {
            if (!inventory) {
                inventory = new UserHorses({ userId: interaction.user.id, horses: new Map(), horseCoins: 0 });
            }
            normalizeHorseMap(inventory);
            if ((inventory.horseCoins || 0) < 0) {
                return interaction.reply({
                    content: `You are in coin debt (**${inventory.horseCoins}**). You cannot gamble until you break even.`,
                    flags: [MessageFlags.Ephemeral]
                });
            }
        }

        // ── HORSE COIN GAMBLE ──────────────────────────────────────────────────
        if (isHorseCoin) {
            const available = isTest ? Infinity : (inventory.horseCoins || 0);
            if (!isTest && available < 2) {
                return interaction.reply({ content: `You need **2 Horse Coins** to gamble a Horse Coin!`, flags: [MessageFlags.Ephemeral] });
            }

            let gamblesCount = count === 0 ? Math.floor(available / 2) : count;
            if (gamblesCount <= 0) {
                return interaction.reply({ content: `You need at least **2 Horse Coins** to gamble.`, flags: [MessageFlags.Ephemeral] });
            }

            if (gamblesCount === 1) {
                const winAmount = Math.floor(Math.random() * 5);
                if (!isTest) {
                    inventory.horseCoins = (inventory.horseCoins - 2) + winAmount;
                    await inventory.save();
                }
                const testTag = isTest ? ' *(test — no coins spent)*' : '';
                return interaction.reply(`You gambled 2 🪙 Horse Coins and got back **${winAmount}** 🪙!${testTag}`);
            }

            let coinsDelta = 0, wins = 0, losses = 0;
            for (let i = 0; i < gamblesCount; i++) {
                const winAmount = Math.floor(Math.random() * 5);
                coinsDelta += (winAmount - 2);
                if (winAmount >= 2) wins++; else losses++;
            }
            if (!isTest) {
                inventory.horseCoins = (inventory.horseCoins || 0) + coinsDelta;
                await inventory.save();
            }
            const testTag = isTest ? '\n*(test mode — no coins spent)*' : '';
            return interaction.reply(
                `🎲 **Gambling Results**\nGambled **${gamblesCount}** Horse Coins: ${wins} wins, ${losses} losses\nNet coins: ${coinsDelta >= 0 ? '+' : ''}${coinsDelta}${testTag}`
            );
        }

        // ── BUILD INITIAL HORSE LIST ───────────────────────────────────────────
        let initialHorsesToGamble = [];

        if (isTopBottom) {
            if (isTest) {
                return interaction.reply({ content: `Test mode is not supported with top/bottom (no inventory to simulate against).`, flags: [MessageFlags.Ephemeral] });
            }
            const sortDir = isTop ? 'desc' : 'asc';
            const sorted = getSortedHorseList(inventory, sortDir);
            if (sorted.length === 0) {
                return interaction.reply({ content: `You don't have any horses to gamble!`, flags: [MessageFlags.Ephemeral] });
            }
            const take = count === 0 ? sorted.length : Math.min(count, sorted.length);
            initialHorsesToGamble = sorted.slice(0, take).map(h => h.slug);
        } else {
            const available = isTest ? 999 : (inventory.horses.get(horseSlug) || 0);
            if (!isTest && available === 0) {
                return interaction.reply({ content: `You don't have any **${horseName(horseSlug)}**!`, flags: [MessageFlags.Ephemeral] });
            }
            const take = count === 0 ? available : Math.min(count, available);
            initialHorsesToGamble = Array(take).fill(horseSlug);
        }

        if (initialHorsesToGamble.length === 0) {
            return interaction.reply({ content: `Nothing to gamble!`, flags: [MessageFlags.Ephemeral] });
        }

        // ── CYCLE MODE ─────────────────────────────────────────────────────────
        if (isCycleMode) {
            await interaction.deferReply();

            // virtualInv.horses: ACTIVE (non-banked) horses only — the gamble pool.
            // bankedHorses: completely separate map, never touched by simulateBulkPass.
            const virtualInv = {
                horses: new Map(isTest
                    ? initialHorsesToGamble.reduce((m, s) => { m.set(s, (m.get(s) || 0) + 1); return m; }, new Map())
                    : new Map(inventory.horses)
                ),
                horseCoins: isTest ? 9999 : (inventory.horseCoins || 0),
            };

            const bankedHorses = new Map();     // slug -> total count banked across all cycles
            let bankingCoinDebt = 0;            // accumulated fractional cost (0.3 per horse banked)
            let totalCoinsSpentOnBanking = 0;   // whole coins actually deducted so far

            let cycleHorses = [...initialHorsesToGamble];
            const cycleLogBlocks = [];
            let haltedEarly = false;
            let haltReason = '';

            for (let c = 1; c <= cycles; c++) {
                // Halt check before each cycle
                if (virtualInv.horseCoins < (config.MIN_CYCLE_COIN_COUNT ?? 0)) {
                    haltedEarly = true;
                    haltReason = `Halted before cycle ${c}: coins (${virtualInv.horseCoins}) fell below MIN_CYCLE_COIN_COUNT (${config.MIN_CYCLE_COIN_COUNT ?? 0}).`;
                    break;
                }
                if (cycleHorses.length === 0) {
                    haltedEarly = true;
                    haltReason = `Halted before cycle ${c}: no horses left to gamble.`;
                    break;
                }

                // ── Banking step ──────────────────────────────────────────────
                // Each horse banked costs 0.3 coins, accumulated fractionally.
                // Whole coins deducted incrementally as ceil(debt) ticks up.
                const bankedThisCycle = [];
                if (bankAbove !== null) {
                    const toGamble = [];
                    for (const slug of cycleHorses) {
                        const val = HORSE_VALUES[slug]?.value ?? 0;
                        if (val > bankAbove && (virtualInv.horses.get(slug) || 0) > 0) {
                            // Move horse out of active pool into the separate bankedHorses map
                            virtualInv.horses.set(slug, virtualInv.horses.get(slug) - 1);
                            bankedHorses.set(slug, (bankedHorses.get(slug) || 0) + 1);
                            bankingCoinDebt += 0.3;
                            bankedThisCycle.push(slug);
                        } else {
                            toGamble.push(slug);
                        }
                    }
                    cycleHorses = toGamble;

                    // Deduct newly-owed whole coins (ceil increments)
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

                // ── Gamble pass ───────────────────────────────────────────────
                const result = simulateBulkPass(cycleHorses, virtualInv);
                const horseLabel = isTop ? 'top horses' : isBottom ? 'bottom horses' : horseName(horseSlug);
                cycleLogBlocks.push(formatCycleLog(c, horseLabel, result, bankedThisCycle, virtualInv.horseCoins));

                // Next cycle pool = everything in virtualInv.horses.
                // bankedHorses is separate so no subtraction needed.
                const nextCycleHorses = [];
                for (const [slug, cnt] of virtualInv.horses.entries()) {
                    if (!HORSE_VALUES[slug] || cnt <= 0) continue;
                    for (let i = 0; i < cnt; i++) nextCycleHorses.push(slug);
                }
                cycleHorses = nextCycleHorses;
            }

            // ── Diff original input vs final active horses ─────────────────────
            const originalMap = new Map();
            for (const s of initialHorsesToGamble) originalMap.set(s, (originalMap.get(s) || 0) + 1);

            const finalActiveMap = new Map();
            for (const [s, cnt] of virtualInv.horses.entries()) {
                if (HORSE_VALUES[s] && cnt > 0) finalActiveMap.set(s, cnt);
            }

            // Final values should also include banked horses (they are protected and still owned).
            const finalFullMap = new Map(finalActiveMap);
            for (const [s, cnt] of bankedHorses.entries()) {
                finalFullMap.set(s, (finalFullMap.get(s) || 0) + cnt);
            }

            // GustoBot receives: horses present in original but missing/reduced in active final
            const lostToHouse = new Map();
            for (const [s, origCnt] of originalMap.entries()) {
                const lost = origCnt - (finalActiveMap.get(s) || 0);
                if (lost > 0) lostToHouse.set(s, lost);
            }

            // GustoBot pays out: horses present in active final beyond original counts
            const gainedFromHouse = new Map();
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

            // ── Apply to DB ────────────────────────────────────────────────────
            if (!isTest) {
                // Write active horses back
                for (const [slug, cnt] of virtualInv.horses.entries()) {
                    inventory.horses.set(slug, cnt);
                }
                // Merge banked horses back in (protected, not consumed)
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
            }

            // ── Final summary ──────────────────────────────────────────────────
            const horseLabel = isTop ? 'top horses' : isBottom ? 'bottom horses' : horseName(horseSlug);
            const finalLines = [
                `🎲 **Final Gambling Results after ${cycleLogBlocks.length} Cycle${cycleLogBlocks.length !== 1 ? 's' : ''}**`,
                `Gambled ${totalGambledCount} ${horseLabel}`,
                `Starting Value: $${originalValue}`,
                `Final Active Value: $${finalActiveValue}`,
                `Banked Value: $${bankedValue}`,
                `Total Value (active + banked): $${finalValue}`,
                `Net Change (active + banked): $${totalNetChange >= 0 ? '+' : ''}${totalNetChange} ($${totalAvgChange >= 0 ? '+' : ''}${totalAvgChange} avg. per horse)`,
                `Final Horses:`,
            ];

            // Active horses sorted by value desc
            const finalGrouped = new Map();
            [...finalActiveMap.entries()]
                .flatMap(([s, cnt]) => Array(cnt).fill(s))
                .sort((a, b) => (HORSE_VALUES[b]?.value ?? 0) - (HORSE_VALUES[a]?.value ?? 0))
                .forEach(s => finalGrouped.set(s, (finalGrouped.get(s) || 0) + 1));
            for (const [s, cnt] of finalGrouped.entries()) {
                finalLines.push(`${cnt} ${horseName(s)} ($${HORSE_VALUES[s]?.value})`);
            }
            if (finalGrouped.size === 0) finalLines.push(`*(none)*`);

            // Banked horses sorted by value desc
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

            // Attach cycle logs + final summary in one file payload.
            const fileContent = [
                `// gamblelog.js generated at ${new Date().toISOString()}`,
                '',
                ...cycleLogBlocks,
                '',
                '=== FINAL SUMMARY ===',
                finalLines.join('\n'),
            ].join('\n\n');

            await interaction.editReply({
                content: finalLines.join('\n'),
                files: [
                    {
                        attachment: Buffer.from(fileContent, 'utf8'),
                        name: 'gamblelog.js',
                    },
                ],
            });
            return;
        }

        // ── SINGLE GAMBLE ──────────────────────────────────────────────────────
        if (initialHorsesToGamble.length === 1) {
            const slug = initialHorsesToGamble[0];

            if (!isTest) {
                inventory.horseCoins -= 1;
                if (inventory.horseCoins < 0 && Math.random() < config.CONFISCATE_CHANCE) {
                    inventory.horses.set(slug, inventory.horses.get(slug) - 1);
                    const houseInv = await getOrCreateInventory(UserHorses, HOUSE_USER_ID);
                    houseInv.horses.set(slug, (houseInv.horses.get(slug) || 0) + 1);
                    await houseInv.save();
                    await inventory.save();
                    return interaction.reply(`🚔 You gambled into debt and the **police confiscated your ${horseName(slug)}**!`);
                }
            }

            const now = Date.now();
            const lastGamble = isTest ? 0 : (inventory.lastGamble || 0);
            let frenzyMessage = "";

            if (!isTest && now - lastGamble < config.FRENZY_THRESHOLD_MS) {
                if (Math.random() < config.FRENZY_CHANCE) {
                    const ownedHorses = [];
                    for (const [s, hCount] of inventory.horses.entries()) {
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
                            const fChange = Math.floor(Math.random() * 201) - 100;
                            const fTarget = victim.value + fChange;
                            const effectivelossthresh = config.LOSS_THRESHOLD - Math.max(0, (victim.value - 100) / 10);
                            if (fChange < effectivelossthresh) {
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
            const change = Math.floor(Math.random() * 201) - 100;
            const targetValue = startValue + change;
            const effectivelossthresh = config.LOSS_THRESHOLD - Math.max(0, (startValue - 100) / 10);

            if (change < effectivelossthresh) {
                if (!isTest) {
                    inventory.horses.set(slug, inventory.horses.get(slug) - 1);
                    const houseInv = await getOrCreateInventory(UserHorses, HOUSE_USER_ID);
                    houseInv.horses.set(slug, (houseInv.horses.get(slug) || 0) + 1);
                    await houseInv.save();
                    await inventory.save();
                }
                const testTag = isTest ? ' *(test)*' : '';
                return interaction.reply(`I told you gambling is bad! You lost your **${horseName(slug)}**!${frenzyMessage}${testTag}`);
            }

            const closestSlug = getClosestHorse(targetValue);
            const endValue = HORSE_VALUES[closestSlug].value;
            const actualDiff = endValue - startValue;

            if (!isTest) {
                inventory.horses.set(slug, inventory.horses.get(slug) - 1);
                inventory.horses.set(closestSlug, (inventory.horses.get(closestSlug) || 0) + 1);

                const commonTransfer = Math.round(Math.abs(actualDiff) / 25);
                if (commonTransfer > 0) {
                    const houseInv = await getOrCreateInventory(UserHorses, HOUSE_USER_ID);
                    if (actualDiff < 0) {
                        houseInv.horses.set(COMMON_HORSE, (houseInv.horses.get(COMMON_HORSE) || 0) + commonTransfer);
                    } else if (actualDiff > 0) {
                        const houseCurrentCommon = houseInv.horses.get(COMMON_HORSE) || 0;
                        houseInv.horses.set(COMMON_HORSE, Math.max(0, houseCurrentCommon - commonTransfer));
                    }
                    await houseInv.save();
                }

                inventory.lastGamble = Date.now();
                await inventory.save();
            }

            let outcomeMsg = "";
            if (closestSlug === slug) {
                outcomeMsg = `The gamble resulted in no change ($0). You kept your **${horseName(slug)}**.`;
            } else {
                const resultText = actualDiff >= 0 ? `won +$${actualDiff}` : `lost $${Math.abs(actualDiff)}`;
                outcomeMsg = `You gambled your **${horseName(slug)}** ($${startValue}) and ${resultText}. You got a **${horseName(closestSlug)}** ($${endValue})!`;
            }
            if (isTest) outcomeMsg += ' *(test)*';

            return interaction.reply(outcomeMsg + frenzyMessage);
        }

        // ── BULK GAMBLE ────────────────────────────────────────────────────────
        let totalWins = 0, totalLosses = 0, totalCompleteLosses = 0, totalNoChange = 0;
        let coinsSpent = 0;
        let netValueChange = 0;
        const gained = new Map();

        const now = Date.now();
        let houseInv = isTest ? null : await getOrCreateInventory(UserHorses, HOUSE_USER_ID);

        for (const slug of initialHorsesToGamble) {
            if (!isTest && (inventory.horses.get(slug) || 0) <= 0) continue;

            if (!isTest) {
                inventory.horseCoins -= 1;
                coinsSpent += 1;
                if (inventory.horseCoins < 0 && Math.random() < config.CONFISCATE_CHANCE) {
                    inventory.horses.set(slug, inventory.horses.get(slug) - 1);
                    houseInv.horses.set(slug, (houseInv.horses.get(slug) || 0) + 1);
                    totalCompleteLosses++;
                    continue;
                }
            } else {
                coinsSpent += 1;
            }

            const startValue = HORSE_VALUES[slug].value;
            const change = Math.floor(Math.random() * 201) - 100;
            const targetValue = startValue + change;
            const effectivelossthresh = config.LOSS_THRESHOLD - Math.max(0, (startValue - 100) / 10);

            if (change < effectivelossthresh) {
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

        if (!isTest) {
            inventory.lastGamble = now;
            await houseInv.save();
            await inventory.save();
        }

        const totalGambled = totalWins + totalLosses + totalCompleteLosses + totalNoChange;
        const avgChange = totalGambled > 0 ? Math.round(netValueChange / totalGambled) : 0;
        const coinsRemaining = isTest ? '(test)' : (inventory.horseCoins || 0);

        let gainedLines = '';
        for (const [slug, gainedCount] of [...gained.entries()].sort((a, b) => b[1] - a[1])) {
            gainedLines += `\n+${gainedCount} **${horseName(slug)}** ($${HORSE_VALUES[slug]?.value})`;
        }

        const remainingLine = (!isTopBottom && !isTest)
            ? `, remaining: ${inventory.horses.get(initialHorsesToGamble[0]) || 0}`
            : '';

        const horseLabel = isTop ? 'top horses' : isBottom ? 'bottom horses' : horseName(initialHorsesToGamble[0]);
        const testTag = isTest ? '\n*(test mode — no horses or coins spent)*' : '';

        const summary = [
            `🎲 **Gambling Results**`,
            `Gambled **${totalGambled}** ${horseLabel}: ${totalWins} wins, ${totalLosses} losses, ${totalCompleteLosses} complete losses, ${totalNoChange} no-changes${remainingLine}`,
            `Net Change: ${netValueChange >= 0 ? '+' : ''}$${netValueChange} (${avgChange >= 0 ? '+' : ''}$${avgChange} avg. per horse)`,
            gainedLines.trim() ? gainedLines.trimStart() : null,
            `Horse Coins Spent: ${coinsSpent}`,
            `Horse Coins Remaining: ${coinsRemaining}`,
            testTag || null,
        ].filter(Boolean).join('\n');

        return interaction.reply(summary);
    }
};