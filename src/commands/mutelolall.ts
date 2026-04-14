import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import mongoose from 'mongoose';

export default {
    data: new SlashCommandBuilder()
        .setName('mutelolall')
        .setDescription('mutes triggers in all channels')
        .addBooleanOption((o: any) => o.setName('status').setDescription('true to mute, false to unmute').setRequired(true))
        .addChannelOption((o: any) => o.setName('exception').setDescription('channel to ignore')),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const MutedChannel = mongoose.model('MutedChannel');
        
        if (!interaction.member) {
            await interaction.reply({ content: 'you have no permission to do this', flags: MessageFlags.Ephemeral });
            return;
        }
        const perms = interaction.member.permissions as any;
        if (!perms.has || !perms.has(PermissionFlagsBits.ManageChannels)) {
            await interaction.reply({ content: 'you have no permission to do this', flags: MessageFlags.Ephemeral });
            return;
        }

        const status = interaction.options.getBoolean('status');
        const exception = interaction.options.getChannel('exception');
        const channels = interaction.guild?.channels.cache.filter((c: any) => c.type === ChannelType.GuildText);

        if (status) {
            for (const [id, channel] of channels || []) {
                if (exception && id === exception.id) continue;
                await MutedChannel.findOneAndUpdate({ channelId: id }, { channelId: id }, { upsert: true });
            }
            await interaction.reply(`muted all channels ${exception ? `except ${exception.name}` : ''}`);
            return;
        } else {
            for (const [id, channel] of channels || []) {
                if (exception && id === exception.id) continue;
                await MutedChannel.deleteOne({ channelId: id });
            }
            await interaction.reply('unmuted all channels');
            return;
        }
    },
};
