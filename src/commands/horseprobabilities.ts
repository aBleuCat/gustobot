import { SlashCommandBuilder, EmbedBuilder, MessageFlags, ChatInputCommandInteraction } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../lib/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
    data: new SlashCommandBuilder()
        .setName('horseprobabilities')
        .setDescription('Check horse probabilities or spin the wheel')
        .setContexts([0, 1, 2])
        .setIntegrationTypes([0, 1])
        .addSubcommand((subcommand: any) =>
            subcommand
                .setName('stats')
                .setDescription('Show the spawn likelihood and message frequency per horse'))
        .addSubcommand((subcommand: any) =>
            subcommand
                .setName('wheel')
                .setDescription('Roll for a random horse (excludes non-spawning horses)')),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const horsesPath = path.join(__dirname, '../horses.json');
        const horsesData = JSON.parse(fs.readFileSync(horsesPath, 'utf8'));
        const horseKeys = Object.keys(horsesData);

        const calculateChance = (value: number) => {
            const denominator = value * config.SPAWN_COEFFICIENT * config.ANTIINFLATOR;
            return 1 / denominator;
        };

        const sub = interaction.options.getSubcommand();

        if (sub === 'stats') {
            let totalRate = 0;
            
            const statsLines = horseKeys
                .map((key: string) => {
                    const horse = horsesData[key];
                    const chance = calculateChance(horse.value);
                    
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
                .sort((a: any, b: any) => b.val - a.val) 
                .map((s: any) => {
                    const nameTag = s.isSpawnable ? s.name : `[NOSPAWN] ${s.name}`;
                    return `${nameTag.padEnd(35)} | ${s.prob}% | 1 in ${s.msgFreq}`;
                });

            const header = `Name                                | Prob       | Avg Messages\n${'-'.repeat(70)}`;
            const footer = `\nTotal chance for ANY horse: ${(totalRate * 100).toFixed(4)}%\nAverage 1 horse every ${Math.round(1 / totalRate)} messages.`;
            
            const fullTable = `\`\`\`\n${header}\n${statsLines.join('\n')}\n${footer}\n\`\`\``;

            await interaction.reply({ content: fullTable });
            return;
        }

        if (sub === 'wheel') {
            await interaction.reply({ content: 'Wheel feature placeholder', flags: MessageFlags.Ephemeral });
        }
    },
};
