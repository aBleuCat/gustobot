const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const mongoose = require('mongoose');
const HorseConfig = mongoose.model('HorseConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('confighorses')
        .setDescription('Configure horse spawning settings')
        .addBooleanOption(o => o.setName('enabled').setDescription('Enable or disable spawning').setRequired(true))
        .addChannelOption(o => o.setName('channel').setDescription('The channel where horse spawns are announced').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
        const enabled = interaction.options.getBoolean('enabled');
        const channel = interaction.options.getChannel('channel');

        await HorseConfig.findOneAndUpdate(
            { guildId: interaction.guildId },
            { enabled: enabled, channelId: channel.id },
            { upsert: true }
        );

        return interaction.reply({ 
            content: `Horse spawning now **${enabled ? 'ON' : 'OFF'}** in <#${channel.id}>.`, 
            ephemeral: false 
        });
    }
};
