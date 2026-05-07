const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');

module.exports = {
    // This defines what you see in the Discord UI
    data: new SlashCommandBuilder()
        .setName('autorolechange')
        .setDescription('Owner Only: Configure autorole swap rules')
        .addUserOption(o => o.setName('messager').setDescription('The user whose mentions to watch').setRequired(true))
        .addUserOption(o => o.setName('target_user').setDescription('The user who will receive the role swap').setRequired(true))
        .addRoleOption(o => o.setName('add_role').setDescription('Role to give the target').setRequired(true))
        .addRoleOption(o => o.setName('restore_role').setDescription('Role to restore for the target').setRequired(true))
        .addIntegerOption(o => o.setName('duration').setDescription('Duration in minutes').setRequired(true))
        .addChannelOption(o => o.setName('channel').setDescription('The channel where this rule triggers').setRequired(true)),
    
    async execute(interaction) {
        if (interaction.user.id !== '934290747623096381') {
            return interaction.reply({ content: "Owner only.", flags: [MessageFlags.Ephemeral] });
        }

        try {
            const Rule = mongoose.model('Rule');

            // We must use the exact names defined in the SlashCommandBuilder above
            const watchUser = interaction.options.getUser('messager');
            const targetUser = interaction.options.getUser('target_user');
            const addRole = interaction.options.getRole('add_role');
            const restoreRole = interaction.options.getRole('restore_role');
            const duration = interaction.options.getInteger('duration');
            const targetChannel = interaction.options.getChannel('channel');
            if (!watchUser || !targetUser || !addRole || !restoreRole || !targetChannel) {
                throw new Error("One or more options failed to send.");
            }

            const newRuleId = Math.floor(100000 + Math.random() * 900000).toString();

            await Rule.findOneAndUpdate(
                { watchUser: watchUser.id, targetUser: targetUser.id, channel: targetChannel.id },
                { 
                    ruleId: newRuleId,
                    addRole: addRole.id, 
                    restoreRole: restoreRole.id, 
                    durationMs: duration * 60000 
                },
                { upsert: true }
            );

            return interaction.reply(`**Rule Set** ID: \`${newRuleId}\`\nIn ${targetChannel}, if **${watchUser.username}** mentions **${targetUser.username}**, they get **${addRole.name}** for ${duration}m before restoring to ${restoreRole.name}`);

        } catch (error) {
            console.error(error);
            return interaction.reply({ content: `**Error:** ${error.message}`, flags: [MessageFlags.Ephemeral] });
        }
    }
};
