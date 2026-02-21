const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('advicebanlist')
        .setDescription('Shows all users currently banned from giving advice.'),
    async execute(interaction) {
        // Handled in index.js
    },
};
