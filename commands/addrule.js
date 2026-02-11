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

    async execute(interaction) { // <--- MAKE SURE ASYNC IS HERE
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        try {
            const messager = interaction.options.getUser('messager');
            const target = interaction.options.getUser('target_user');
            const channel = interaction.options.getChannel('channel');
            const addRole = interaction.options.getRole('add_role');
            const restoreRole = interaction.options.getRole('restore_role');
            const duration = interaction.options.getInteger('duration');

            if (!messager || !target || !channel || !addRole || !restoreRole) {
                return await interaction.editReply({ 
                    content: '❌ Error: Failed to retrieve options.' 
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

            await interaction.editReply({ 
                content: `✅ **Rule Saved!** ID: \`${newRule.ruleId}\`\nWatching <@${messager.id}> to mention <@${target.id}> in <#${channel.id}>.` 
            });

        } catch (error) {
            console.error(error);
            if (interaction.deferred) {
                await interaction.editReply({ content: '❌ Database error occurred.' });
            }
        }
    }
};
