const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { config } = require('../lib/config.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('horseprobabilities')
        .setDescription('Check horse probabilities or spin the wheel')
        .setContexts([0, 1, 2])
        .setIntegrationTypes([0, 1])
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('Show the spawn likelihood and message frequency per horse'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('wheel')
                .setDescription('Roll for a random horse (excludes non-spawning horses)')),

    async execute(interaction) {
        // 1. Load Data
        const horsesPath = path.join(__dirname, '../horses.json');
        const horsesData = JSON.parse(fs.readFileSync(horsesPath, 'utf8'));
        const horseKeys = Object.keys(horsesData);

        // 2. Helper Logic
        const calculateChance = (value) => {
            // Formula from config.js: 1 / (value * SPAWN_COEFFICIENT * ANTIINFLATOR)
            const denominator = value * config.SPAWN_COEFFICIENT * config.ANTIINFLATOR;
            return 1 / denominator;
        };

        const sub = interaction.options.getSubcommand();

        // --- STATS SUBCOMMAND ---
        if (sub === 'stats') {
            let totalRate = 0;
            
            const statsLines = horseKeys
                .map(key => {
                    const horse = horsesData[key];
                    const chance = calculateChance(horse.value);
                    
                    // Only add to the total rate if it's a spawning horse
                    if (horse.spawn !== false) {
                        totalRate += chance;
                    }

                    return { 
                        name: horse.name, 
                        val: horse.value, 
                        prob: (chance * 100).toFixed(5),
                        msgFreq: Math.round(1 / chance).toLocaleString(),
                        isSpawnable: horse.spawn !== false
                    };
                })
                .sort((a, b) => b.val - a.val) 
                .map(s => {
                    const nameTag = s.isSpawnable ? s.name : `[NOSPAWN] ${s.name}`;
                    return `${nameTag.padEnd(35)} | ${s.prob}% | 1 in ${s.msgFreq}`;
                });

            const header = `Name                                | Prob       | Avg Messages\n${'-'.repeat(70)}`;
            const footer = `\nTotal chance for ANY horse: ${(totalRate * 100).toFixed(4)}%\nAverage 1 horse every ${Math.round(1 / totalRate)} messages.`;
            
            const fullTable = `\`\`\`\n${header}\n${statsLines.join('\n')}\n${footer}\n\`\`\``;

            return await interaction.reply({ content: fullTable });
        }

        // --- WHEEL SUBCOMMAND ---
        if (sub === 'wheel') {
            // Filter out horses where spawn is explicitly false
            const spawnableKeys = horseKeys.filter(key => horsesData[key].spawn !== false);

            if (spawnableKeys.length === 0) {
                return await interaction.reply({ content: "No horses are currently set to spawn!", flags: [MessageFlags.Ephemeral] });
            }

            const pool = spawnableKeys.map(key => ({
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

            const chance = calculateChance(selectedHorse.value);
            const embed = new EmbedBuilder()
                .setTitle(`Woah the wheel landed on...`)
                .setColor(selectedHorse.value > config.FLAIR_THRESHOLD_VALUE ? '#FFD700' : '#6463FA')
                .setDescription(`You rolled: **${selectedHorse.name}**`)
                .addFields(
                    { name: 'Value', value: `${selectedHorse.value}`, inline: true },
                    { name: 'Rarity', value: `1 in ${Math.round(1 / chance).toLocaleString()} msgs`, inline: true }
                );

            if (selectedHorse.link && selectedHorse.link.startsWith('http')) {
                embed.setImage(selectedHorse.link);
            }

            await interaction.reply({ embeds: [embed] });
        }
    },
};