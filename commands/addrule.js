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
        // 1. Get the objects first
        const messager = interaction.options.getUser('messager');
        const target = interaction.options.getUser('target');
        const channel = interaction.options.getChannel('channel');
        const addRole = interaction.options.getRole('add');
        const restoreRole = interaction.options.getRole('restore');
        const duration = interaction.options.getInteger('duration');

        // 2. Safety Check: Ensure nothing is null before reading .id
        if (!messager || !target || !channel || !addRole || !restoreRole) {
            return interaction.reply({ 
                content: '❌ Error: One of the users, roles, or channels could not be found. Please try again.', 
                ephemeral: true 
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

        try {
            await newRule.save();
            await interaction.reply({ 
                content: `✅ **Rule Saved to Cloud!**\n**ID:** \`${newRule.ruleId}\`\n**Trigger:** <@${messager.id}> talking in <#${channel.id}>\n**Action:** Swapping <@${target.id}> to <@&${addRole.id}> for ${duration} hour(s).`, 
                ephemeral: true 
            });
        } catch (error) {
            console.error('Database Save Error:', error);
            await interaction.reply({ content: '❌ Failed to save rule to the database.', ephemeral: true });
        }
    }
};
