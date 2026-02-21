const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('banadvice')
        .setDescription('Bans or unbans a user from using the advicegive command.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to ban/unban')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Only admins can see/use this
    async execute(interaction) {
        // Logic is handled in index.js
    },
};
