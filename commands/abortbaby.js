const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('abortbaby')
        .setDescription('abortion is still legal here dw'),
    async execute(interaction) {
    },
};
