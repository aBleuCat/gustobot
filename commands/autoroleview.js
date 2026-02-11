const { SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autoroleview')
        .setDescription('View all autorole rules'),

    async execute(interaction) {
        const Rule = mongoose.model('Rule');
        const rules = await Rule.find();

        if (rules.length === 0) return interaction.reply('No rules found in cloud.');

        let list = rules.map(r => `ID: \`${r.ruleId}\` | <@${r.watchUser}> triggers on <@${r.targetUser}>`).join('\n');
        await interaction.reply({ content: `**Cloud Rules:**\n${list}`, ephemeral: true });
    }
};
