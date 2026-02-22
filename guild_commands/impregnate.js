const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('impregnate')
        .setDescription('impregnate someone')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('user to impregnate')
                .setRequired(true)),
    async execute(interaction) {
    },
};
