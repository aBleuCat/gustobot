import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChatInputCommandInteraction } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('abortbaby')
        .setDescription('Remove the pregnant role from a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addUserOption((o: any) => o.setName('user').setDescription('Target user').setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const member = await interaction.guild!.members.fetch(interaction.options.getUser('user')!.id);
        const pregnantRole = interaction.guild!.roles.cache.find((r: any) => r.name.toLowerCase() === 'pregnant');

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
