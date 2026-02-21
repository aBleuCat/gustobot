const { SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('totaladvice')
        .setDescription('Shows the total number of advice entries and the top contributor'),

    async execute(interaction) {
        const Advice = mongoose.model('Advice');

        try {
            const count = await Advice.countDocuments();
            
            // Aggregation to find the most frequent authorId
            const topStats = await Advice.aggregate([
                { $group: { _id: "$authorId", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 1 }
            ]);

            let topText = "";
            if (topStats.length > 0) {
                const topUser = await interaction.client.users.fetch(topStats[0]._id).catch(() => null);
                topText = `\n**Top Contributor:** ${topUser ? topUser.username : "Unknown"} (${topStats[0].count} entries)`;
            }

            return interaction.reply(`There are currently **${count}** pieces of wisdom in the circle.${topText}`);
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: 'Error counting advice.', ephemeral: true });
        }
    },
};
