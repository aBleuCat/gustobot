import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChatInputCommandInteraction } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('impregnate')
        .setDescription('Give the pregnant role to a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addUserOption((o: any) => o.setName('user').setDescription('Target user').setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const member = await interaction.guild!.members.fetch(interaction.options.getUser('user')!.id);
        const pregnantRole = interaction.guild!.roles.cache.find((r: any) => r.name.toLowerCase() === 'pregnant')
            || await interaction.guild!.roles.create({ name: 'pregnant', reason: 'Created by impregnate command' });

        if (member.roles.cache.has(pregnantRole.id)) {
            await interaction.reply({ content: `${member.user.username} already has the pregnant role`, flags: MessageFlags.Ephemeral });
            return;
        }

        await member.roles.add(pregnantRole);
        await interaction.reply({ content: `Gave pregnant role to ${member.user.username}`, flags: MessageFlags.Ephemeral });
    }
};
