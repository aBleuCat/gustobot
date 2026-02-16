const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('modchannel')
        .setDescription('Set the channel for bot activity logs')
        .addChannelOption(o => o.setName('channel').setDescription('The channel to log to').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        
        const channel = interaction.options.getChannel('channel');
        const ModChannel = mongoose.model('ModChannel');

        // Update if exists, otherwise create new
        await ModChannel.findOneAndUpdate(
            { guildId: interaction.guild.id },
            { channelId: channel.id },
            { upsert: true }
        );

        await interaction.editReply({ content: `Mod channel set to <#${channel.id}> for logging bot actions.` });
    }
};
