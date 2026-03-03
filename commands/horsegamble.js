const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');
const HORSE_VALUES = require('../horses.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('horsegamble')
        .setDescription('Gamble a horse for a chance at a different one!')
        .addStringOption(option =>
            option.setName('horse')
                .setDescription('The horse you want to gamble. 1-hour cooldown.')
                .setRequired(true)
                .addChoices(
                    { name: 'Commonosity and Normaltude', value: 'Horse of Commonosity and Normaltude' },
                    { name: 'Truth and Affirmation', value: 'Horse of Truth and Affirmation' },
                    { name: 'Patience and Wisdom', value: 'Horse of Patience and Wisdom' },
                    { name: 'Comfort and Relaxation', value: 'Horse of Comfort and Relaxation' },
                    { name: 'Lies and Deceit', value: 'Horse of Lies and Deceit' },
                    { name: 'Despair and Agony', value: 'Horse of Despair and Agony' },
                    { name: 'Dung Beetle', value: 'Dung Beetle' },
                    { name: 'Providence and All Knowing', value: 'Horse of Providence and All Knowing' }
                )),
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
        const cooldown = 1 * 60 * 60 * 1000; // 1 Hour
        const lastGamble = inventory.lastGamble || 0;
        const isOwner = interaction.user.id === '934290747623096381';

        if (!isOwner && (now - lastGamble < cooldown)) {
            const remaining = cooldown - (now - lastGamble);
            const minutes = Math.floor(remaining / (1000 * 60));
            const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
            return interaction.reply({ 
                content: `Hold your horses! You can try again in ${minutes}m ${seconds}s.`,  
            });
        }

        // Generates a random integer between -100 and 100 inclusive.
        // Every number in the range has an equal 1/201 chance.
        const change = Math.floor(Math.random() * 201) - 100;

        const startValue = HORSE_VALUES[horseName].value;
        const targetValue = startValue + change;

        let closestHorse = horseName;
        let minDiff = Infinity;

        // Find closest match in the master JSON
        for (const [name, data] of Object.entries(HORSE_VALUES)) {
            const diff = Math.abs(data.value - targetValue);
            if (diff < minDiff) {
                minDiff = diff;
                closestHorse = name;
            }
        }

        // Calculate REAL profit/loss based on the horse actually received
        const endValue = HORSE_VALUES[closestHorse].value;
        const actualDiff = endValue - startValue;

        // Update Database
        inventory.horses.set(horseName, inventory.horses.get(horseName) - 1);
        inventory.horses.set(closestHorse, (inventory.horses.get(closestHorse) || 0) + 1);
        inventory.lastGamble = now;
        await inventory.save();

        if (closestHorse === horseName) {
            return interaction.reply(`The gamble resulted in no change ($0). You kept your **${horseName}**. Be thankful, could've been worse.`);
        }

        const resultText = actualDiff >= 0 ? `won +$${actualDiff}` : `lost $${actualDiff}`;
        const outcomeMsg = `You gambled your **${horseName}** ($${startValue}) and ${resultText}. You got a **${closestHorse}** ($${endValue})!`;

        return interaction.reply(outcomeMsg);
    }
};
