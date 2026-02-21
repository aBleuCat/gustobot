const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('scream')
        .setDescription('moves the eternal screaming to a specific channel')
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('the voice channel to haunt')
                .setRequired(true)),
    async execute(interaction) {
        // logic handled in index.js
    },
};
