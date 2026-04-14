import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
import mongoose from 'mongoose';

export default {
    data: new SlashCommandBuilder()
        .setName('mutelol')
        .setDescription('Stop the bot from saying lol in a specific channel')
        .addChannelOption((option: any) => 
            option.setName('channel')
                .setDescription('The channel to mute/unmute')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const channel = interaction.options.getChannel('channel');
        const MutedChannel = mongoose.model('MutedChannel');

        const existing = await MutedChannel.findOne({ channelId: channel!.id });

        if (existing) {
            await existing.deleteOne();
            await interaction.reply(`I will now say "lol" in ${channel} again.`);
        } else {
            await new MutedChannel({ channelId: channel!.id }).save();
            await interaction.reply(`I will no longer say "lol" in ${channel}.`);
        }
    },
};
