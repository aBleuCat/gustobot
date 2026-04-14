import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('advicebanlist')
        .setDescription('Shows all users currently banned from giving advice.'),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        // Handled in index.js
    },
};
