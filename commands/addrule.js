const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
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
        // 1. Tell Discord to wait (Fixes "Interaction Failed")
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        console.log('Interaction Options:', JSON.stringify(interaction.options.data, null, 2));

        try {
            const messager = interaction.options.getUser('messager');
            const target = interaction.options.getUser('target');
            const channel = interaction.options.getChannel('channel');
            const addRole = interaction.options.getRole('add');
            const restoreRole = interaction.options.getRole('restore');
            const duration = interaction.options.getInteger('duration');

            // 2. Extra safety check
            if (!messager || !target || !channel || !addRole || !restoreRole) {
                return interaction.editReply({ content: '❌ Could not find all users/roles. Please try again.' });
            }

            const Rule = mongoose.model('Rule');
            const newRule = new Rule({
                ruleId: Date.now().toString().slice(-6),
                watchUser: messager.id,
                targetUser: target.id,
                channel: channel.id,
                addRole: addRole.id,
                restoreRole: restoreRole.id,
                durationMs: duration * 60 * 60 * 1000
            });

            await newRule.save();

            // 3. Edit the original "thinking" message with the success info
            await interaction.editReply({ 
                content: `✅ **Rule Saved!** ID: \`${newRule.ruleId}\`\nWatching <@${messager.id}> in <#${channel.id}>.` 
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: '❌ Database error! Check Koyeb logs.' });
        }
    }
};
