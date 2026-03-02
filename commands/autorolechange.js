const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');
const Rule = mongoose.model('Rule');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autorolechange')
        .setDescription('Owner Only: Configure autorole swap rules')
        .addUserOption(o => o.setName('watch').setDescription('The user whose mentions to watch').setRequired(true))
        .addUserOption(o => o.setName('target').setDescription('The user who will receive the role swap').setRequired(true))
        .addRoleOption(o => o.setName('add').setDescription('Role to give the target').setRequired(true))
        .addRoleOption(o => o.setName('restore').setDescription('Role to restore for the target').setRequired(true))
        .addIntegerOption(o => o.setName('duration').setDescription('Duration in minutes').setRequired(true))
        .addChannelOption(o => o.setName('channel').setDescription('The channel where this rule triggers').setRequired(true)),
    async execute(interaction) {
        if (interaction.user.id !== '934290747623096381') {
            return interaction.reply({ content: "Owner only.", flags: [MessageFlags.Ephemeral] });
        }

        const watchUser = interaction.options.getUser('watch');
        const targetUser = interaction.options.getUser('target');
        const addRole = interaction.options.getRole('add');
        const restoreRole = interaction.options.getRole('restore');
        const duration = interaction.options.getInteger('duration');
        const targetChannel = interaction.options.getChannel('channel');
        await Rule.findOneAndUpdate(
            { watchUser: watchUser.id, channel: targetChannel.id },
            { 
                targetUser: targetUser.id, 
                addRole: addRole.id, 
                restoreRole: restoreRole.id, 
                durationMs: duration * 60000 
            },
            { upsert: true }
        );

        return interaction.reply(`Rule set for ${targetChannel}\nOn ${watchUser.username} mentions ${targetUser.username}:\n${targetUser.username} swaps roles for ${duration} minutes before restoring ${restoreRole.username}`);
    }
};
