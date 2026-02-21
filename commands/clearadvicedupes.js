const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const mongoose = require('mongoose');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearadvicedupes')
        .setDescription('Cleans the database of duplicate advice entries')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const Advice = mongoose.model('Advice');

        try {
            // Finding duplicates based on the 'content' field
            const duplicates = await Advice.aggregate([
                {
                    $group: {
                        _id: { content: "$content" },
                        dupes: { $push: "$_id" },
                        count: { $sum: 1 }
                    }
                },
                {
                    $match: {
                        count: { $gt: 1 }
                    }
                }
            ]);

            let totalDeleted = 0;

            for (const doc of duplicates) {
                // Keep the first one, delete the rest
                const idsToDelete = doc.dupes.slice(1);
                await Advice.deleteMany({ _id: { $in: idsToDelete } });
                totalDeleted += idsToDelete.length;
            }

            return interaction.editReply(`Database cleaned! Removed **${totalDeleted}** duplicate advice entries.`);
        } catch (error) {
            console.error(error);
            return interaction.editReply("An error occurred while cleaning the database.");
        }
    },
};
