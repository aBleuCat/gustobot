const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dm')
        .setDescription('Makes the bot DM a specific user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to message')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('message')
                .setDescription('The message to send')
                .setRequired(true)), 

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const messageText = interaction.options.getString('message');

        try {
            await targetUser.send(messageText);
            await interaction.reply({ 
                content: `Successfully sent message to **${targetUser.displayName}**.`, 
                ephemeral: true 
            });
        } catch (error) {
            console.error(error);
            await interaction.reply({ 
                content: `I couldn't DM **${targetUser.displayName}**. They might have their DMs closed.`, 
                ephemeral: true 
            });
        }
    },
};
