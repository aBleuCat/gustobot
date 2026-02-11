const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autoroleview')
        .setDescription('View all saved role trigger rules'),

    async execute(interaction) {
        const path = './data/rules.json';
        
        if (!fs.existsSync(path)) {
            return interaction.reply({ content: 'No rules found. Create one with `/autorolechange`!', ephemeral: true });
        }

        const rules = JSON.parse(fs.readFileSync(path, 'utf8'));
        if (rules.length === 0) {
            return interaction.reply({ content: 'The rule list is empty.', ephemeral: true });
        }

        let message = '**Current Rules:**\n';
        rules.forEach(r => {
            message += `ID: \`${r.id}\` | <@${r.watchUser}> triggers on <@${r.targetUser}> in <#${r.channel}>\n`;
        });

        await interaction.reply({ content: message, ephemeral: true });
    }
};