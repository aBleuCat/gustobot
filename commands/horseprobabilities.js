const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { config } = require('../lib/config.js'); 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('horse')
        .setDescription('Check horse probabilities or spin the wheel')
        .setContexts([0, 1, 2])
        .setIntegrationTypes([0, 1])
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('Show the spawn likelihood of each horse per message'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('wheel')
                .setDescription('Roll for a random horse based on rarity')),

    async execute(interaction) {
        // load data
        const horsesPath = path.join(__dirname, '../horses.json');
        const horsesData = JSON.parse(fs.readFileSync(horsesPath, 'utf8'));
        const horseKeys = Object.keys(horsesData);

        const calculateChance = (value) => {
            // Formula: 1 / (value * SPAWN_COEFFICIENT * ANTIINFLATOR)
            const denominator = value * config.SPAWN_COEFFICIENT * config.ANTIINFLATOR;
            return 1 / denominator;
        };

        const sub = interaction.options.getSubcommand();

        // stats sub
        if (sub === 'stats') {
            let totalRate = 0;
            const statsLines = horseKeys
                .map(key => {
                    const horse = horsesData[key];
                    const chance = calculateChance(horse.value);
                    totalRate += chance;
                    return { name: horse.name, val: horse.value, prob: (chance * 100).toFixed(5) };
                })
                .sort((a, b) => b.val - a.val) // Rarest first
                .map(s => `${s.name.padEnd(30)} | ${s.prob}%`);

            const header = `Name                           | Prob (per msg)\n${'-'.repeat(48)}`;
            const fullTable = `\`\`\`\n${header}\n${statsLines.join('\n')}\n\nTotal Spawn Rate: ${(totalRate * 100).toFixed(4)}%\n\`\`\``;

            return await interaction.reply({ content: fullTable });
        }

        // wheel sub
        if (sub === 'wheel') {
            const pool = horseKeys.map(key => ({
                key,
                weight: calculateChance(horsesData[key].value)
            }));

            const totalWeight = pool.reduce((sum, h) => sum + h.weight, 0);
            let random = Math.random() * totalWeight;
            let selectedHorse = null;

            for (const item of pool) {
                if (random < item.weight) {
                    selectedHorse = horsesData[item.key];
                    break;
                }
                random -= item.weight;
            }

            const embed = new EmbedBuilder()
                .setTitle(`🎡 The Great Horse Wheel Spins...`)
                .setColor(selectedHorse.value > config.FLAIR_THRESHOLD_VALUE ? '#FFD700' : '#6463FA')
                .setDescription(`You rolled: **${selectedHorse.name}**`)
                .addFields(
                    { name: 'Value', value: `${selectedHorse.value}`, inline: true },
                    { name: 'Rarity', value: `${(calculateChance(selectedHorse.value) * 100).toFixed(6)}%`, inline: true }
                );

            if (selectedHorse.link && selectedHorse.link.startsWith('http')) {
                embed.setImage(selectedHorse.link);
            }

            await interaction.reply({ embeds: [embed] });
        }
    },
};