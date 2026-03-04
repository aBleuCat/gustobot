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
                .setDescription('The horse to gamble. Gambling too much and you may go crazy!')
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
        let frenzyMessage = "";

        // --- GAMBLING FRENZY LOGIC ---
        if (now - lastGamble < frenzyThreshold) {
            if (Math.random() < 0.20) { // 1/5 chance
                const ownedHorses = [];
                
                // Using .entries() for Mongoose Map compatibility
                for (const [name, count] of inventory.horses.entries()) {
                    if (count > 0 && HORSE_VALUES[name]) {
                        // If it's the horse currently being gambled, only count the "extra" ones
                        const availableCount = (name === horseName) ? count - 1 : count;
                        for (let i = 0; i < availableCount; i++) {
                            ownedHorses.push({ name, value: HORSE_VALUES[name].value });
                        }
                    }
                }

                // Sort: lowest value first
                ownedHorses.sort((a, b) => a.value - b.value);
                
                // Take up to 3 cheapest
                const victims = ownedHorses.slice(0, 3);

                if (victims.length > 0) {
                    frenzyMessage = `\n\n🔥 **GAMBLING FRENZY!** You got too excited! You accidentally put ${victims.length} more horses into the pit:`;
                    
                    for (const victim of victims) {
                        const fChange = Math.floor(Math.random() * 201) - 100;
                        const fTarget = victim.value + fChange;
                        
                        // Deduct victim
                        inventory.horses.set(victim.name, inventory.horses.get(victim.name) - 1);

                        if (fChange < -75 || fTarget < 0) {
                            frenzyMessage += `\n* Your **${victim.name}** ran away in the confusion!`;
                        } else {
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

        // primary roll
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
        
        // Final Save
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
