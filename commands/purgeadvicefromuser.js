const { SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purgeadvicefromuser')
        .setDescription('Deletes all advice entries submitted by a specific user (Owner Only)')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user whose advice you want to purge')
                .setRequired(true)),

    async execute(interaction) {
        // Owner ID Check
        if (interaction.user.id !== '934290747623096381') {
            return interaction.reply({ 
                content: 'You do not have permission to use this command. This is an owner-only action.', 
                ephemeral: true 
            });
        }

        const Advice = mongoose.model('Advice');
        const target = interaction.options.getUser('target');

        try {
            const result = await Advice.deleteMany({ authorId: target.id });

            if (result.deletedCount === 0) {
                return interaction.reply({ 
                    content: `No advice found from **${target.username}**.`, 
                    ephemeral: true 
                });
            }

            return interaction.reply({ 
                content: `Successfully purged **${result.deletedCount}** pieces of advice from **${target.username}**.` 
            });
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: 'Error trying to purge advice.', ephemeral: true });
        }
    },
};
