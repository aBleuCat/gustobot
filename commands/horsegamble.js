const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');

// Price Table
const HORSE_VALUES = {
    "Dung Beetle": 10,
    "Horse of Commonosity and Normaltude": 25,
    "Horse of Truth and Affirmation": 100,
    "Horse of Patience and Wisdom": 100,
    "Horse of Comfort and Relaxation": 100,
    "Horse of Lies and Deceit": 100,
    "Horse of Despair and Agony": 100,
    "Horse of Providence and All Knowing": 500
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('horsegamble')
        .setDescription('Test your luck! You can only gamble once per day, max win/loss ~$100.')
        .addStringOption(option =>
            option.setName('horse')
                .setDescription('The horse you want to gamble')
                .setRequired(true)
                .addChoices(
                    { name: 'Dung Beetle', value: 'Dung Beetle' },
                    { name: 'Commonosity', value: 'Horse of Commonosity and Normaltude' },
                    { name: 'Truth/Affirmation', value: 'Horse of Truth and Affirmation' },
                    { name: 'Patience/Wisdom', value: 'Horse of Patience and Wisdom' },
                    { name: 'Comfort/Relaxation', value: 'Horse of Comfort and Relaxation' },
                    { name: 'Lies/Deceit', value: 'Horse of Lies and Deceit' },
                    { name: 'Despair/Agony', value: 'Horse of Despair and Agony' },
                    { name: 'Providence', value: 'Horse of Providence and All Knowing' }
                )),
    async execute(interaction) {
        const UserHorses = mongoose.model('UserHorses');
        const horseName = interaction.options.getString('horse');
        let inventory = await UserHorses.findOne({ userId: interaction.user.id });

        if (!inventory || (inventory.horses.get(horseName) || 0) <= 0) {
            return interaction.reply({ content: `You don't have a **${horseName}** to gamble! Use \`/horsescollection\` to see which horses you have`, flags: [MessageFlags.Ephemeral] });
        }

        // Daily Check + Immunity for you
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        const lastGamble = inventory.lastGamble || 0;
        const isOwner = interaction.user.id === '934290747623096381';

        if (!isOwner && (now - lastGamble < oneDay)) {
            const remaining = oneDay - (now - lastGamble);
            const hours = Math.floor(remaining / (1000 * 60 * 60));
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            return interaction.reply({ content: `Already addicted! You can only gamble once per day, as per state law. Try again in ${hours}h ${minutes}m.` });
        }

        // Weighted Random (-100 to 100, centered at 0)
        const u1 = Math.random();
        const u2 = Math.random();
        const normalRand = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        let change = Math.round(normalRand * 35); 
        if (change > 100) change = 100;
        if (change < -100) change = -100;

        const startValue = HORSE_VALUES[horseName];
        const targetValue = startValue + change;

        // Find closest horse by value
        let closestHorse = horseName;
        let minDiff = Infinity;

        for (const [name, val] of Object.entries(HORSE_VALUES)) {
            const diff = Math.abs(val - targetValue);
            if (diff < minDiff) {
                minDiff = diff;
                closestHorse = name;
            }
        }

        // Update Inventory
        inventory.horses.set(horseName, inventory.horses.get(horseName) - 1);
        inventory.horses.set(closestHorse, (inventory.horses.get(closestHorse) || 0) + 1);
        inventory.lastGamble = now;
        await inventory.save();

        const resultText = change >= 0 ? `won (+$${change})` : `lost ($${change})`;
        const outcomeMsg = closestHorse === horseName 
            ? `The gamble resulted in no change. You kept your **${horseName}**. Could have gone worse; be thankful.`
            : `You gambled your **${horseName}** ($${startValue}) and ${resultText} a **${closestHorse}** ($${HORSE_VALUES[closestHorse]})!`;

        return interaction.reply(outcomeMsg);
    }
};
