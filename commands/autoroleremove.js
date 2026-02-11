const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autoroleremove')
        .setDescription('Remove a role trigger rule by its ID')
        .addStringOption(option => 
            option.setName('id')
                .setDescription('The 6-digit ID of the rule')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const id = interaction.options.getString('id');
        const path = './data/rules.json';

        if (!fs.existsSync(path)) return interaction.reply({ content: 'No rules exist to remove.', ephemeral: true });

        let rules = JSON.parse(fs.readFileSync(path, 'utf8'));
        const originalLength = rules.length;
        
        // Keep everything EXCEPT the one with the matching ID
        rules = rules.filter(r => r.id !== id);

        if (rules.length === originalLength) {
            return interaction.reply({ content: `Could not find a rule with ID \`${id}\`.`, ephemeral: true });
        }

        fs.writeFileSync(path, JSON.stringify(rules, null, 2));
        await interaction.reply({ content: `Rule \`${id}\` has been removed successfully.`, ephemeral: true });
    }
};