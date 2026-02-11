const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autorolechange')
        .setDescription('Add a role trigger rule')
        .addUserOption(o => o.setName('messager').setDescription('Trigger user').setRequired(true))
        .addUserOption(o => o.setName('target_user').setDescription('User to swap').setRequired(true))
        .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true))
        .addRoleOption(o => o.setName('add_role').setDescription('Temporary role').setRequired(true))
        .addRoleOption(o => o.setName('restore_role').setDescription('Role to return').setRequired(true))
        .addIntegerOption(o => o.setName('duration').setDescription('Hours').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // 1. FIX: Tell Discord "I am thinking..." (This stops the "Not Responding" error)
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        try {
            // 2. FIX: Use the exact names from your Koyeb logs
            const messager = interaction.options.getUser('messager');
            const target = interaction.options.getUser('target_user'); 
            const channel = interaction.options.getChannel('channel');
            const addRole = interaction.options.getRole('add_role');
            const restoreRole = interaction.options.getRole('restore_role');
            const duration = interaction.options.getInteger('duration');

            // 3. Safety Check
            if (!messager || !target || !channel || !addRole || !restoreRole) {
                return await interaction.editReply({ 
                    content: '❌ One of the options was missing. Make sure you selected them from the menu!' 
                });
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

            // 4. Send the final success message
            await interaction.editReply({ 
                content: `✅ **Rule Saved!** ID: \`${newRule.ruleId}\`\nWatching <@${messager.id}> to mention <@${target.id}> in <#${channel.id}>.` 
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: '❌ Something went wrong with the database.' });
        }
    }
};
