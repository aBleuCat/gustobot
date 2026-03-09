const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const HORSE_VALUES = require('../horses.json');
const mongoose = require('mongoose');

const HOUSE_USER_ID = '1469509600561729710';
const COMMON_HORSE = 'Horse of Commonosity and Normaltude';

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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('horsegamble')
        .setDescription('Play the hand of fate and gamble a horse!')
        .addStringOption(option =>
            option.setName('horse')
                .setDescription('The horse to gamble, or "Horse Coin" to gamble coins.')
                .setRequired(true)
                .setAutocomplete(true)
        ),

    async autocomplete(interaction) {
        const UserHorses = mongoose.model('UserHorses');
        const focused = interaction.options.getFocused().toLowerCase();
        const inventory = await UserHorses.findOne({ userId: interaction.user.id });

        const choices = [];

        if ((inventory?.horseCoins || 0) >= 2) {
            choices.push({ name: '🪙 Horse Coin', value: 'Horse Coin' });
        }

        if (inventory?.horses) {
            for (const [name, count] of inventory.horses.entries()) {
                if (count > 0 if (count > 0 && HORSE_VALUES[name] && HORSE_VALUES[name].comp !== false)if (count > 0 && HORSE_VALUES[name] && HORSE_VALUES[name].comp !== false) HORSE_VALUES[name]) {
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
        const isHorseCoin = horseName.toLowerCase() === 'horse coin';

        let inventory = await UserHorses.findOne({ userId: interaction.user.id });

        if (!isHorseCoin && !HORSE_VALUES[horseName]) {
            const match = Object.keys(HORSE_VALUES).find(k => k.toLowerCase() === horseName.toLowerCase());
            const suggestion = match ? ` Did you mean **${match}**?` : '';
            return interaction.reply({ content: `**${horseName}** isn't a valid horse.${suggestion}`, flags: [MessageFlags.Ephemeral] });
        }

        if (!isHorseCoin && (inventory?.horses?.get(horseName) || 0) <= 0) {
            return interaction.reply({ content: `You don't have a **${horseName}**!`, flags: [MessageFlags.Ephemeral] });
        }

        if (isHorseCoin) {
            if ((inventory?.horseCoins || 0) < 2) {
                return interaction.reply({ content: `You need **2 Horse Coins** to gamble a Horse Coin (bid + fee)!`, flags: [MessageFlags.Ephemeral] });
            }
            const winAmount = Math.floor(Math.random() * 5);
            inventory.horseCoins = (inventory.horseCoins - 2) + winAmount;
            await inventory.save();
            return interaction.reply(`You gambled 2 🪙 Horse Coins and got back **${winAmount}** 🪙!`);
        }

        const now = Date.now();
        const lastGamble = inventory.lastGamble || 0;
        const frenzyThreshold = 10 * 60 * 1000;
        let frenzyMessage = "";

        if ((inventory.horseCoins || 0) < 1) {
            if (Math.random() < 0.40) {
                inventory.horses.set(horseName, inventory.horses.get(horseName) - 1);
                const houseInv = await getOrCreateInventory(UserHorses, HOUSE_USER_ID);
                houseInv.horses.set(horseName, (houseInv.horses.get(horseName) || 0) + 1);
                await houseInv.save();
                await inventory.save();
                return interaction.reply(`🚔 You tried to gamble without a Horse Coin and the **police confiscated your ${horseName}**!`);
            }
        } else {
            inventory.horseCoins -= 1;
        }

        if (now - lastGamble < frenzyThreshold) {
            if (Math.random() < 0.20) {
                const ownedHorses = [];
                for (const [name, count] of inventory.horses.entries()) {
                    if (count > 0 && HORSE_VALUES[name]) {
                        const availableCount = (name === horseName) ? count - 1 : count;
                        for (let i = 0; i < availableCount; i++) {
                            ownedHorses.push({ name, value: HORSE_VALUES[name].value });
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
                        if (fChange < -75 || fTarget < 0) {
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

        const startValue = HORSE_VALUES[horseName].value;
        const change = Math.floor(Math.random() * 201) - 100;
        const targetValue = startValue + change;

        if (change < -75 || targetValue < 0) {
            inventory.horses.set(horseName, inventory.horses.get(horseName) - 1);
            const houseInv = await getOrCreateInventory(UserHorses, HOUSE_USER_ID);
            houseInv.horses.set(horseName, (houseInv.horses.get(horseName) || 0) + 1);
            await houseInv.save();
            await inventory.save();
            return interaction.reply(`I told you gambling is bad! You lost your **${horseName}**!${frenzyMessage}`);
        }

        const closestHorse = getClosestHorse(targetValue);
        const endValue = HORSE_VALUES[closestHorse].value;
        const actualDiff = endValue - startValue;

        inventory.horses.set(horseName, inventory.horses.get(horseName) - 1);
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

        let outcomeMsg = "";
        if (closestHorse === horseName) {
            outcomeMsg = `The gamble resulted in no change ($0). You kept your **${horseName}**.`;
        } else {
            const resultText = actualDiff >= 0 ? `won +$${actualDiff}` : `lost $${Math.abs(actualDiff)}`;
            outcomeMsg = `You gambled your **${horseName}** ($${startValue}) and ${resultText}. You got a **${closestHorse}** ($${endValue})!`;
        }

        return interaction.reply(outcomeMsg + frenzyMessage);
    }
};
