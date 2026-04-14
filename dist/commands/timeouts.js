import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import mongoose from 'mongoose';
export default {
    data: new SlashCommandBuilder()
        .setName('timeouts')
        .setDescription('View active role swap timeouts')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    async execute(interaction) {
        await interaction.deferReply();
        const Timeout = mongoose.model('Timeout');
        const timeouts = await Timeout.find({ guildId: interaction.guild.id });
        if (!timeouts.length) {
            await interaction.editReply('No active timeouts.');
        }
        const lines = timeouts.map((t) => {
            const expiresAt = new Date(t.expiresAt);
            const timestamp = Math.floor(expiresAt.getTime() / 1000);
            return `• <@${t.userId}> → <@&${t.toRole}> (expires <t:${timestamp}:R>)`;
        });
        await interaction.editReply({
            content: `**Active Timeouts** (${timeouts.length}):\n${lines.join('\n')}`
        });
    }
};
//# sourceMappingURL=timeouts.js.map