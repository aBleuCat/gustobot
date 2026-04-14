import { SlashCommandBuilder } from 'discord.js';
export default {
    data: new SlashCommandBuilder()
        .setName('advicebanlist')
        .setDescription('Shows all users currently banned from giving advice.'),
    async execute(interaction) {
        // Handled in index.js
    },
};
//# sourceMappingURL=advicebanlist.js.map