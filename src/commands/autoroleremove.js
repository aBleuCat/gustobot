const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
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
        if (interaction.user.id !== '934290747623096381') {
            return interaction.reply({ content: "Owner only.", flags: [MessageFlags.Ephemeral] });
        }
        const id = interaction.options.getString('id');
        
        // Access the Rule model we defined in index.js
        const Rule = mongoose.model('Rule');

        // Try to delete the rule from MongoDB
        const result = await Rule.deleteOne({ ruleId: id });

        if (result.deletedCount === 0) {
            return interaction.reply({ 
                content: `Could not find a rule with ID \`${id}\` in the database.`, 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        await interaction.reply({ 
            content: `Rule \`${id}\` has been removed from the cloud database.`, 
            flags: [MessageFlags.Ephemeral] 
        });
    }
};
