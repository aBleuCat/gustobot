const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');
const HORSE_VALUES = require('../horses.json');
// get from json
const horseChoices = Object.keys(HORSE_VALUES).map(name => ({
    name: name,
    value: name
}));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('horsegamble')
        .setDescription('Play the hand of fate and gamble a horse!')
        .addStringOption(option =>
            option.setName('horse')
                .setDescription('The horse to gamble. Gambling again within 10m and you may go crazy!')
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
        const frenzyThreshold = 10 * 60 * 1000; // 10 Minutes
        let frenzyOccurred = false;
        let frenzyMessage = "";

        // frenzy
        if (now - lastGamble < frenzyThreshold) {
            if (Math.random() < 0.20) { // 1/5 chance
                frenzyOccurred = true;
                
                // Get all owned horses, sorted by value (cheapest first)
                const ownedHorses = [];
                for (const [name, count] of inventory.horses) {
                    if (count > 0 && HORSE_VALUES[name]) {
                        for (let i = 0; i < count; i++) {
                            ownedHorses.push({ name, value: HORSE_VALUES[name].value });
                        }
                    }
                }

                // Sort: lowest value first
                ownedHorses.sort((a, b) => a.value - b.value);
                
                // Take up to 3 (excluding the one being gambled right now)
                const victims = ownedHorses
                    .filter(h => h.name !== horseName)
                    .slice(0, 3);

                if (victims.length > 0) {
                    frenzyMessage = `\n\n🔥 **GAMBLING FRENZY!** You got too excited and lost control! The bot forced 3 more horses into the pit:`;
                    
                    for (const victim of victims) {
                        // Process a mini-gamble for each victim
                        const fChange = Math.floor(Math.random() * 201) - 100;
                        const fTarget = victim.value + fChange;
                        
                        // Remove the victim first
                        inventory.horses.set(victim.name, inventory.horses.get(victim.name) - 1);

                        if (fChange < -75 || fTarget < 0) {
                            frenzyMessage += `\n* Your **${victim.name}** ran away during the chaos!`;
                        } else {
                            // Find closest
                            let fClosest = victim.name;
                            let fMinDiff = Infinity;
                            for (const [vName, vData] of Object.entries(HORSE_VALUES)) {
                                const d = Math.abs(vData.value - fTarget);
                                if (d < fMinDiff) { fMinDiff = d; fClosest = vName; }
                            }
                            inventory.horses.set(fClosest, (inventory.horses.get(fClosest) || 0) + 1);
                            frenzyMessage += `\n* Your **${victim.name}** was traded for a **${fClosest}**.`;
                        }
                    }
                }
            }
        }

        // prmary roll
        const change = Math.floor(Math.random() * 201) - 100;
        const startValue = HORSE_VALUES[horseName].value;
        const targetValue = startValue + change;

        // Process primary loss/gain
        if (change < -75 || targetValue < 0) {
            inventory.horses.set(horseName, inventory.horses.get(horseName) - 1);
            inventory.lastGamble = now;
            await inventory.save();
            return interaction.reply(`I told you gambling is bad! You lost your **${horseName}**!${frenzyMessage}`);
        }

        let closestHorse = horseName;
        let minDiff = Infinity;
        for (const [name, data] of Object.entries(HORSE_VALUES)) {
            const diff = Math.abs(data.value - targetValue);
            if (diff < minDiff) { minDiff = diff; closestHorse = name; }
        }

        const endValue = HORSE_VALUES[closestHorse].value;
        const actualDiff = endValue - startValue;

        // Update primary result
        inventory.horses.set(horseName, inventory.horses.get(horseName) - 1);
        inventory.horses.set(closestHorse, (inventory.horses.get(closestHorse) || 0) + 1);
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
