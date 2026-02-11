const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const mongoose = require('mongoose');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autorolechange')
        .setDescription('Add a role trigger rule')
        .addUserOption(o => o.setName('messager').setDescription('Trigger user').setRequired(true))
        .addUserOption(o => o.setName('target').setDescription('User to swap').setRequired(true))
        .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true))
        .addRoleOption(o => o.setName('add').setDescription('Temporary role').setRequired(true))
        .addRoleOption(o => o.setName('restore').setDescription('Role to return').setRequired(true))
        .addIntegerOption(o => o.setName('duration').setDescription('Hours').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const Rule = mongoose.model('Rule');
        const newRule = new Rule({
            ruleId: Date.now().toString().slice(-6),
            watchUser: interaction.options.getUser('messager').id,
            targetUser: interaction.options.getUser('target').id,
            channel: interaction.options.getChannel('channel').id,
            addRole: interaction.options.getRole('add').id,
            restoreRole: interaction.options.getRole('restore').id,
            durationMs: interaction.options.getInteger('duration') * 60 * 60 * 1000
        });

        await newRule.save();
        await interaction.reply({ content: `Rule saved to Cloud! ID: **${newRule.ruleId}**`, ephemeral: true });
    }
};
