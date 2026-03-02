const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const mongoose = require('mongoose');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeouts')
        .setDescription('View all active role-swaps')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const Timeout = mongoose.model('Timeout');
        const activeTimeouts = await Timeout.find({});

        if (activeTimeouts.length === 0) {
            return interaction.reply({ content: "There are no active role-swap timeouts.", ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('⏳ Active Role Timeouts')
            .setColor('#6463FA');

        const list = activeTimeouts.map(t => {
            const unixSeconds = Math.floor(t.revertAt / 1000);
            return `<@${t.targetUser}>: Has <@&${t.addRole}>, restores to <@&${t.restoreRole}> <t:${unixSeconds}:R>`;
        }).join('\n');

        embed.setDescription(list);
        await interaction.reply({ embeds: [embed] });
    },
};
