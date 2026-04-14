import { SlashCommandBuilder } from 'discord.js';
export default {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Test command'),
    async execute(interaction) {
        await interaction.reply('Pong!');
    },
};
//# sourceMappingURL=ping.js.map