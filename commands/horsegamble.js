const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const HORSE_VALUES = require('../horses.json');
const mongoose = require('mongoose');
const { config } = require('../lib/config');

const HOUSE_USER_ID = '1469509600561729710';
const COMMON_HORSE = 'Horse of Commonosity and Normaltude';
const ADMIN_IDS = ['934290747623096381', '853658523786412063']; // .i.exist and webcubed

function getClosestHorse(targetValue) {
    let minDiff = Infinity;
    let candidates = [];
    for (const [name, data] of Object.entries(HORSE_VALUES)) {
        if (data.comp === false) continue;
        const diff = Math.abs(data.value - targetValue);
        if (diff < minDiff) { minDiff = diff; candidates = [name]; }
        else if (diff === minDiff) { candidates.push(name); }
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
}

async function getOrCreateInventory(UserHorses, userId) {
    let inv = await UserHorses.findOne({ userId });
    if (!inv) inv = new UserHorses({ userId, horses: new Map(), horseCoins: 0 });
    return inv;
}

// Expand a player's inventory into a sorted flat list of { name, value } entries
// sortDir: 'asc' for bottom (cheapest first), 'desc' for top (most expensive first)
function getSortedHorseList(inventory, sortDir = 'asc') {
    const list = [];
    for (const [name, count] of inventory.horses.entries()) {
        if (count > 0 && HORSE_VALUES[name]) {
            for (let i = 0; i < count; i++) {
                list.push({ name, value: HORSE_VALUES[name].value });
            }
        }
    }
    list.sort((a, b) => sortDir === 'asc' ? a.value - b.value : b.value - a.value);
    return list;
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
        .addBooleanOption(option =>
            option.setName('test')
                .setDescription('(Admin only) Simulate gambles without spending horses.')
                .setRequired(false)
        ),

    async autocomplete(interaction) {
        const UserHorses = mongoose.model('UserHorses');
        const focused = interaction.options.getFocused().toLowerCase();
        const inventory = await UserHorses.findOne({ userId: interaction.user.id });

        const choices = [
            { name: 'any from top — gamble most valuable horses', value: 'top' },
            { name: 'any from bottom — gamble least valuable horses', value: 'bottom' },
        ];

        if ((inventory?.horseCoins || 0) >= 2) {
            choices.push({ name: '🪙 Horse Coin', value: 'Horse Coin' });
        }

        if (inventory?.horses) {
            for (const [name, count] of inventory.horses.entries()) {
                if (count > 0 && HORSE_VALUES[name]) {
                    choices.push({ name: `${name} (x${count})`, value: name });
                }
            }
        }

        const filtered = choices
            .filter(c => c.name.toLowerCase().includes(focused))
            .slice(0, 25);

        await interaction.respond(filtered);
    },

    async execute(interaction) {
        const UserHorses = mongoose.model('UserHorses');
        const horseName = interaction.options.getString('horse').trim();
        let count = interaction.options.getInteger('count') ?? 1;
        const isTest = interaction.options.getBoolean('test') ?? false;
        const isHorseCoin = horseName.toLowerCase() === 'horse coin';
        const isTop = horseName.toLowerCase() === 'top';
        const isBottom = horseName.toLowerCase() === 'bottom';
        const isTopBottom = isTop || isBottom;
        const isAdmin = ADMIN_IDS.includes(interaction.user.id);

        // Admin-only test mode
        if (isTest && !isAdmin) {
            return interaction.reply({ content: `You don't have permission to use test mode.`, flags: [MessageFlags.Ephemeral] });
        }

        // Validate horse name for normal mode
        if (!isHorseCoin && !isTopBottom && !HORSE_VALUES[horseName]) {
            const match = Object.keys(HORSE_VALUES).find(k => k.toLowerCase() === horseName.toLowerCase());
            const suggestion = match ? ` Did you mean **${match}**?` : '';
            return interaction.reply({ content: `**${horseName}** isn't a valid horse.${suggestion}`, flags: [MessageFlags.Ephemeral] });
        }

        let inventory = isTest ? null : await UserHorses.findOne({ userId: interaction.user.id });

        if (!isTest) {
            if (!inventory) {
                inventory = new UserHorses({ userId: interaction.user.id, horses: new Map(), horseCoins: 0 });
            }

            if ((inventory.horseCoins || 0) < 0) {
                return interaction.reply({
                    content: `You are in coin debt (**${inventory.horseCoins}**). You cannot gamble until you break even.`,
                    flags: [MessageFlags.Ephemeral]
                });
            }
        }

        // horse coin gambling mode
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

            // bulk coin gamble
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

        // horse list for top/bottom mode
        let horsesToGamble = []; // array of horse names to gamble, in order

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
            horsesToGamble = sorted.slice(0, take).map(h => h.name);
        } else {
            // Normal specific-horse mode
            const available = isTest ? 999 : (inventory.horses.get(horseName) || 0);
            if (!isTest && available === 0) {
                return interaction.reply({ content: `You don't have any **${horseName}**!`, flags: [MessageFlags.Ephemeral] });
            }
            const take = count === 0 ? available : Math.min(count, available);
            horsesToGamble = Array(take).fill(horseName);
        }

        if (horsesToGamble.length === 0) {
            return interaction.reply({ content: `Nothing to gamble!`, flags: [MessageFlags.Ephemeral] });
        }

        // single horse gambling w/ frenzy
        if (horsesToGamble.length === 1) {
            const name = horsesToGamble[0];

            if (!isTest) {
                inventory.horseCoins -= 1;
                if (inventory.horseCoins < 0 && Math.random() < config.CONFISCATE_CHANCE) {
                    inventory.horses.set(name, inventory.horses.get(name) - 1);
                    const houseInv = await getOrCreateInventory(UserHorses, HOUSE_USER_ID);
                    houseInv.horses.set(name, (houseInv.horses.get(name) || 0) + 1);
                    await houseInv.save();
                    await inventory.save();
                    return interaction.reply(`🚔 You gambled into debt and the **police confiscated your ${name}**!`);
                }
            }

            const now = Date.now();
            const lastGamble = isTest ? 0 : (inventory.lastGamble || 0);
            let frenzyMessage = "";

            if (!isTest && now - lastGamble < config.FRENZY_THRESHOLD_MS) {
                if (Math.random() < config.FRENZY_CHANCE) {
                    const ownedHorses = [];
                    for (const [hName, hCount] of inventory.horses.entries()) {
                        if (hCount > 0 && HORSE_VALUES[hName]) {
                            const availableCount = (hName === name) ? hCount - 1 : hCount;
                            for (let i = 0; i < availableCount; i++) {
                                ownedHorses.push({ name: hName, value: HORSE_VALUES[hName].value });
                            }
                        }
                    }
                    ownedHorses.sort((a, b) => a.value - b.value);
                    const victims = ownedHorses.slice(0, 2);
                    if (victims.length > 0) {
                        frenzyMessage = `\n\n🔥 **GAMBLING FRENZY!** You got too excited! You accidentally put ${victims.length} more horses into the pit:`;
                        for (const victim of victims) {
                            inventory.horses.set(victim.name, inventory.horses.get(victim.name) - 1);
                            const fChange = Math.floor(Math.random() * 201) - 100;
                            const fTarget = victim.value + fChange;
                            let effectivelossthresh = config.LOSS_THRESHOLD - Math.max(0, (victim.value - 100) / 10);
                            if (fChange < effectivelossthresh) {
                                frenzyMessage += `\n* Your **${victim.name}** ran away in the confusion!`;
                            } else {
                                const fClosest = getClosestHorse(fTarget);
                                inventory.horses.set(fClosest, (inventory.horses.get(fClosest) || 0) + 1);
                                frenzyMessage += `\n* Your **${victim.name}** was traded for a **${fClosest}**.`;
                            }
                        }
                    }
                }
            }

            const startValue = HORSE_VALUES[name].value;
            const change = Math.floor(Math.random() * 201) - 100;
            const targetValue = startValue + change;
            let effectivelossthresh = config.LOSS_THRESHOLD - Math.max(0, (startValue - 100) / 10);

            if (change < effectivelossthresh) {
                if (!isTest) {
                    inventory.horses.set(name, inventory.horses.get(name) - 1);
                    const houseInv = await getOrCreateInventory(UserHorses, HOUSE_USER_ID);
                    houseInv.horses.set(name, (houseInv.horses.get(name) || 0) + 1);
                    await houseInv.save();
                    await inventory.save();
                }
                const testTag = isTest ? ' *(test)*' : '';
                return interaction.reply(`I told you gambling is bad! You lost your **${name}**!${frenzyMessage}${testTag}`);
            }

            const closestHorse = getClosestHorse(targetValue);
            const endValue = HORSE_VALUES[closestHorse].value;
            const actualDiff = endValue - startValue;

            if (!isTest) {
                inventory.horses.set(name, inventory.horses.get(name) - 1);
                inventory.horses.set(closestHorse, (inventory.horses.get(closestHorse) || 0) + 1);

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

                inventory.lastGamble = now;
                await inventory.save();
            }

            let outcomeMsg = "";
            if (closestHorse === name) {
                outcomeMsg = `The gamble resulted in no change ($0). You kept your **${name}**.`;
            } else {
                const resultText = actualDiff >= 0 ? `won +$${actualDiff}` : `lost $${Math.abs(actualDiff)}`;
                outcomeMsg = `You gambled your **${name}** ($${startValue}) and ${resultText}. You got a **${closestHorse}** ($${endValue})!`;
            }
            if (isTest) outcomeMsg += ' *(test)*';

            return interaction.reply(outcomeMsg + frenzyMessage);
        }

        // bulk gambling
        let totalWins = 0, totalLosses = 0, totalCompleteLosses = 0, totalNoChange = 0;
        let coinsSpent = 0;
        let netValueChange = 0;
        const gained = new Map(); // horseName -> count of that horse gained

        const now = Date.now();
        let houseInv = isTest ? null : await getOrCreateInventory(UserHorses, HOUSE_USER_ID);

        for (const name of horsesToGamble) {
            if (!isTest && (inventory.horses.get(name) || 0) <= 0) continue;

            if (!isTest) {
                inventory.horseCoins -= 1;
                coinsSpent += 1;

                if (inventory.horseCoins < 0 && Math.random() < config.CONFISCATE_CHANCE) {
                    inventory.horses.set(name, inventory.horses.get(name) - 1);
                    houseInv.horses.set(name, (houseInv.horses.get(name) || 0) + 1);
                    totalCompleteLosses++;
                    continue;
                }
            } else {
                coinsSpent += 1;
            }

            const startValue = HORSE_VALUES[name].value;
            const change = Math.floor(Math.random() * 201) - 100;
            const targetValue = startValue + change;
            let effectivelossthresh = config.LOSS_THRESHOLD - Math.max(0, (startValue - 100) / 10);

            if (change < effectivelossthresh) {
                // complete loss goes to house
                if (!isTest) {
                    inventory.horses.set(name, inventory.horses.get(name) - 1);
                    houseInv.horses.set(name, (houseInv.horses.get(name) || 0) + 1);
                }
                netValueChange -= startValue;
                totalCompleteLosses++;
            } else {
                const closestHorse = getClosestHorse(targetValue);
                const endValue = HORSE_VALUES[closestHorse].value;
                const actualDiff = endValue - startValue;

                if (!isTest) {
                    inventory.horses.set(name, inventory.horses.get(name) - 1);
                }

                if (closestHorse === name) {
                    if (!isTest) {
                        inventory.horses.set(name, (inventory.horses.get(name) || 0) + 1);
                    }
                    totalNoChange++;
                } else {
                    if (!isTest) {
                        inventory.horses.set(closestHorse, (inventory.horses.get(closestHorse) || 0) + 1);

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

                    gained.set(closestHorse, (gained.get(closestHorse) || 0) + 1);
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

        // breakdown per horse
        let gainedLines = '';
        for (const [gainedName, gainedCount] of [...gained.entries()].sort((a, b) => b[1] - a[1])) {
            const val = HORSE_VALUES[gainedName]?.value;
            gainedLines += `\n+${gainedCount} **${gainedName}** ($${val})`;
        }

        // remaining count for single-horse mode
        const remainingLine = (!isTopBottom && !isTest)
            ? `, remaining: ${inventory.horses.get(horsesToGamble[0]) || 0}`
            : '';

        const horseLabel = isTop ? 'top horses' : isBottom ? 'bottom horses' : horsesToGamble[0];
        const testTag = isTest ? '\n*(test mode — no horses or coins spent)*' : '';

        // more detailed summary
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