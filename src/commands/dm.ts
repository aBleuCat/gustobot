import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChatInputCommandInteraction } from 'discord.js';

const DM_ALLOWED_USER_IDS = new Set([
    '853658523786412063',
    '934290747623096381'
]);

export default {
    data: new SlashCommandBuilder()
        .setName('dm')
        .setDescription('Makes the bot DM a specific user')
        .addUserOption((option: any) => 
            option.setName('user')
                .setDescription('The user to message')
                .setRequired(true))
        .addStringOption((option: any) => 
            option.setName('message')
                .setDescription('The message to send')
                .setRequired(true)), 

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!DM_ALLOWED_USER_IDS.has(interaction.user.id)) {
            await interaction.reply({
                content: 'You do not have permission to use this command.',
                flags: MessageFlags.Ephemeral
            });
        }

        const targetUser = interaction.options.getUser('user');
        const messageText = interaction.options.getString('message');

        try {
            await targetUser?.send(messageText || '');
            await interaction.reply({ 
                content: `Successfully sent message to **${targetUser?.displayName}**.`, 
                flags: MessageFlags.Ephemeral 
            });
        } catch (error) {
            console.error(error);
            await interaction.reply({ 
                content: `I couldn't DM **${targetUser?.displayName}**. They might have their DMs closed.`, 
                flags: MessageFlags.Ephemeral 
            });
        }
    },
};
