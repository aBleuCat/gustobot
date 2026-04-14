import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import HORSE_VALUES from '../horses.json' assert { type: 'json' };

export default {
    data: new SlashCommandBuilder()
        .setName('horseslugs')
        .setDescription('List all horse name to slug mappings.'),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const mappings = Object.entries(HORSE_VALUES)
            .map(([slug, data]: any) => `• **${data.name}** → ${slug}`)
            .join('\n');
        const embed = new EmbedBuilder()
            .setTitle('Horse Name → Slug Mappings')
            .setDescription(mappings)
            .setColor(0x8B4513);
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
