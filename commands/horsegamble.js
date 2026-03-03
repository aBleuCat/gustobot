const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');
const HORSE_VALUES = require('../horses.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('horsegamble')
        .setDescription('Trade a horse for a chance at a different one!')
        .addStringOption(option =>
            option.setName('horse')
                .setDescription('The horse you want to gamble. Max gambling once per day.')
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

        // Checking inventory
        if (!inventory || (inventory.horses.get(horseName) || 0) <= 0) {
            return interaction.reply({ 
                content: `You don't have a **${horseName}**! Check \`/horsescollection\`.`, 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        const lastGamble = inventory.lastGamble || 0;
        const isOwner = interaction.user.id === '934290747623096381';

        // Immunity check for you
        if (!isOwner && (now - lastGamble < oneDay)) {
            const remaining = oneDay - (now - lastGamble);
            const hours = Math.floor(remaining / (1000 * 60 * 60));
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            return interaction.reply({ 
                content: `Already addicted! You can try again in ${hours}h ${minutes}m.`,  
            });
        }

        // The Gamble Logic
        const u1 = Math.random();
        const u2 = Math.random();
        const normalRand = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        let change = Math.round(normalRand * 35); 
        if (change > 100) change = 100;
        if (change < -100) change = -100;

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

        // Update Database
        inventory.horses.set(horseName, inventory.horses.get(horseName) - 1);
        inventory.horses.set(closestHorse, (inventory.horses.get(closestHorse) || 0) + 1);
        inventory.lastGamble = now;
        await inventory.save();

        const resultText = change >= 0 ? `won (+$${change})` : `lost ($${change})`;
        const outcomeMsg = closestHorse === horseName 
            ? `The gamble resulted in no change. You kept your **${horseName}**. Could have gone worse; be thankful.`
            : `You gambled your **${horseName}** ($${startValue}) and ${resultText} a **${closestHorse}** ($${HORSE_VALUES[closestHorse].value})!`;

        return interaction.reply(outcomeMsg);
    }
};
