import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import mongoose from 'mongoose';
export default {
    data: new SlashCommandBuilder()
        .setName('purgeadvicefromuser')
        .setDescription('Remove all advice from a user (admin)')
        .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const Advice = mongoose.model('Advice');
        const result = await Advice.deleteMany({ userId: user.id });
        await interaction.reply({
            content: `Removed **${result.deletedCount}** advice entries from ${user}.`,
            flags: MessageFlags.Ephemeral
        });
    }
};
//# sourceMappingURL=purgeadvicefromuser.js.map