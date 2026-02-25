const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const mongoose = require('mongoose');
const MutedChannel = mongoose.model('MutedChannel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mutelolall')
        .setDescription('mutes triggers in all channels')
        .addBooleanOption(o => o.setName('status').setDescription('true to mute, false to unmute').setRequired(true))
        .addChannelOption(o => o.setName('exception').setDescription('channel to ignore')),
    async execute(interaction) {
        // check perms
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({ content: 'you have no permission to do this', flags: [1 << 6] });
        }

        const status = interaction.options.getBoolean('status');
        const exception = interaction.options.getChannel('exception');
        const channels = interaction.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);

        if (status) {
            // mute all
            for (const [id, channel] of channels) {
                if (exception && id === exception.id) continue;
                await MutedChannel.findOneAndUpdate({ channelId: id }, { channelId: id }, { upsert: true });
            }
            return interaction.reply(`muted all channels ${exception ? `except ${exception.name}` : ''}`);
        } else {
            // unmute all
            for (const [id, channel] of channels) {
                if (exception && id === exception.id) continue;
                await MutedChannel.deleteOne({ channelId: id });
            }
            return interaction.reply('unmuted all channels');
        }
    },
};
