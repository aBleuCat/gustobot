import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
export default {
    data: new SlashCommandBuilder()
        .setName('abortbaby')
        .setDescription('Remove the pregnant role from a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true)),
    async execute(interaction) {
        const member = await interaction.guild.members.fetch(interaction.options.getUser('user').id);
        const pregnantRole = interaction.guild.roles.cache.find((r) => r.name.toLowerCase() === 'pregnant');
        if (!pregnantRole) {
            await interaction.reply({ content: 'No "pregnant" role found', flags: MessageFlags.Ephemeral });
            return;
        }
        if (!member.roles.cache.has(pregnantRole.id)) {
            await interaction.reply({ content: `${member.user.username} doesn't have the pregnant role`, flags: MessageFlags.Ephemeral });
            return;
        }
        await member.roles.remove(pregnantRole);
        await interaction.reply({ content: `Removed pregnant role from ${member.user.username}`, flags: MessageFlags.Ephemeral });
    }
};
//# sourceMappingURL=abortbaby.js.map