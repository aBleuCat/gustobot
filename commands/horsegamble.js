const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const HORSE_VALUES = require('../horses.json');
const mongoose = require('mongoose');

// generate choices from the JSON keys
const horseChoices = Object.keys(HORSE_VALUES).map(name => ({
    name: name,
    value: name
}));

function getClosestHorse(targetValue) {
    let minDiff = Infinity;
    let candidates = [];

    for (const [name, data] of Object.entries(HORSE_VALUES)) {
        const diff = Math.abs(data.value - targetValue);
        if (diff < minDiff) {
            minDiff = diff;
            candidates = [name];
        } else if (diff === minDiff) {
            candidates.push(name);
        }
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('horsegamble')
        .setDescription('Play the hand of fate and gamble a horse!')
        .addStringOption(option =>
            option.setName('horse')
                .setDescription('The horse to gamble. Gamble too much and you may go crazy!')
                .setRequired(true)
                .addChoices(...horseChoices.slice(0, 25))
        ),
    async execute(interaction) {
        const UserHorses = mongoose.model('UserHorses');
        const horseName = interaction.options.getString('horse');
        let inventory = await UserHorses.findOne({ userId: interaction.user.id });

        if (!inventory || (inventory.horses.get(horseName) || 0) <= 0) {
            return interaction.reply({ 
                content: `You don't have a **${horseName}**!`, 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        const now = Date.now();
        const lastGamble = inventory.lastGamble || 0;
        const frenzyThreshold = 10 * 60 * 1000;
        const debtResetThreshold = 2 * 60 * 60 * 1000; // 2 hours
        let frenzyMessage = "";

        // Horse Coin logic
    const isHorseCoin = horseName === 'Horse Coin';

    if (isHorseCoin) {
        // Costs 2 coins (bid + fee), returns 1-4 coins
        if ((inventory.horseCoins || 0) < 2) {
            return interaction.reply({ content: `You need **2 Horse Coins** to gamble a Horse Coin (bid + fee)!`, flags: [MessageFlags.Ephemeral] });
        }
        const winAmount = Math.floor(Math.random() * 4) + 1;
        inventory.horseCoins = (inventory.horseCoins - 2) + winAmount;
        await inventory.save();
        return interaction.reply(`You gambled 2 🪙 Horse Coins and got back **${winAmount}** 🪙!`);
    }

    // Requires 1 horse coin to gamble
    if ((inventory.horseCoins || 0) < 1) {
        // 40% chance of confiscation instead
        if (Math.random() < 0.40) {
            inventory.horses.set(horseName, inventory.horses.get(horseName) - 1);
            await inventory.save();
            return interaction.reply(`🚔 You tried to gamble without a Horse Coin and the **police confiscated your ${horseName}**!`);
        }
    } else {
        inventory.horseCoins -= 1;
    }
        
        // le frenzy
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
                        const fChange = Math.floor(Math.random() * (201 + lossBias)) - 100 - lossBias;
                        const fTarget = victim.value + fChange;
                        
                        inventory.horses.set(victim.name, inventory.horses.get(victim.name) - 1);

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

        // main roll
        const change = Math.floor(Math.random() * (201 + lossBias)) - 100 - lossBias;
        const startValue = HORSE_VALUES[horseName].value;
        const targetValue = startValue + change;

        if (change < -75 || targetValue < 0) {
            inventory.horses.set(horseName, inventory.horses.get(horseName) - 1);
            await inventory.save();
            return interaction.reply(`I told you gambling is bad! You lost your **${horseName}**!${frenzyMessage}`);
        }

        const closestHorse = getClosestHorse(targetValue);
        const endValue = HORSE_VALUES[closestHorse].value;
        const actualDiff = endValue - startValue;

        inventory.horses.set(horseName, inventory.horses.get(horseName) - 1);
        inventory.horses.set(closestHorse, (inventory.horses.get(closestHorse) || 0) + 1);
        
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
