import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import mongoose from 'mongoose';
export default {
    data: new SlashCommandBuilder()
        .setName('confighorses')
        .setDescription('Configure horse spawning settings')
        .addBooleanOption((o) => o.setName('enabled').setDescription('Enable or disable spawning').setRequired(true))
        .addChannelOption((o) => o.setName('channel').setDescription('The channel where horse spawns are announced').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setContexts([0, 1, 2])
        .setIntegrationTypes([0, 1]),
    async execute(interaction) {
        const HorseConfig = mongoose.model('HorseConfig');
        const ownerId = '934290747623096381';
        const isOwner = interaction.user.id === ownerId;
        const isAdmin = interaction.memberPermissions && interaction.memberPermissions.has(PermissionFlagsBits.Administrator);
        if (!isOwner && !isAdmin) {
            await interaction.reply({
                content: "You don't have permission to configure horse spawning.",
                flags: MessageFlags.Ephemeral
            });
        }
        const enabled = interaction.options.getBoolean('enabled');
        const channel = interaction.options.getChannel('channel');
        await HorseConfig.findOneAndUpdate({ guildId: interaction.guildId }, { enabled: enabled, channelId: channel.id }, { upsert: true });
        await interaction.reply({
            content: `Horse spawning now **${enabled ? 'ON' : 'OFF'}** in <#${channel.id}>.`,
            ephemeral: false
        });
    }
};
//# sourceMappingURL=confighorses.js.map