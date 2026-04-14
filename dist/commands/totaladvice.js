import { SlashCommandBuilder } from 'discord.js';
import mongoose from 'mongoose';
export default {
    data: new SlashCommandBuilder()
        .setName('totaladvice')
        .setDescription('Get total advice count and top contributors'),
    async execute(interaction) {
        await interaction.deferReply();
        const Advice = mongoose.model('Advice');
        const totalCount = await Advice.countDocuments();
        const contributorStats = await Advice.aggregate([
            { $group: { _id: '$userId', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);
        let statsText = `**Total Advice**: ${totalCount}\n\n**Top Contributors**:\n`;
        contributorStats.forEach((stat, i) => {
            statsText += `${i + 1}. <@${stat._id}> — ${stat.count} advice\n`;
        });
        await interaction.editReply(statsText);
    }
};
//# sourceMappingURL=totaladvice.js.map