import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import HORSE_VALUES from '../horses.json' assert { type: 'json' };
export default {
    data: new SlashCommandBuilder()
        .setName('horseslugs')
        .setDescription('List all horse name to slug mappings.'),
    async execute(interaction) {
        const mappings = Object.entries(HORSE_VALUES)
            .map(([slug, data]) => `• **${data.name}** → ${slug}`)
            .join('\n');
        const embed = new EmbedBuilder()
            .setTitle('Horse Name → Slug Mappings')
            .setDescription(mappings)
            .setColor(0x8B4513);
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
//# sourceMappingURL=horseslugs.js.map