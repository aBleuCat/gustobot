const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const mongoose = require('mongoose');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autoroleremove')
        .setDescription('Remove an autorole trigger by its ID')
        .addStringOption(option => 
            option.setName('id')
                .setDescription('The 6-digit ID of the rule')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const id = interaction.options.getString('id');
        
        // Access the Rule model we defined in index.js
        const Rule = mongoose.model('Rule');

        // Try to delete the rule from MongoDB
        const result = await Rule.deleteOne({ ruleId: id });

        if (result.deletedCount === 0) {
            return interaction.reply({ 
                content: `Could not find a rule with ID \`${id}\` in the database.`, 
                ephemeral: true 
            });
        }

        await interaction.reply({ 
            content: `Rule \`${id}\` has been removed from the cloud database.`, 
            ephemeral: true 
        });
    }
};
