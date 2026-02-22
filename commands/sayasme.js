const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sayasme')
        .setDescription('Make the bot say something in this channel')
        .addStringOption(opt => opt.setName('message').setDescription('What should I say?').setRequired(true))
        // This hides the command from anyone who isn't an Admin
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setContexts([0, 1, 2]) 
        .setIntegrationTypes([0, 1]),

    async execute(interaction) {
        const ownerId = '934290747623096381';
        const isOwner = interaction.user.id === ownerId;
        const isAdmin = interaction.memberPermissions && interaction.memberPermissions.has(PermissionFlagsBits.Administrator);

        if (!isOwner && !isAdmin) {
            return interaction.reply({ 
                content: "You don't have permission to make me talk.", 
                ephemeral: true 
            });
        }

        const text = interaction.options.getString('message');

        try {
            await interaction.channel.send(text);
            return interaction.reply({ content: "Message sent.", ephemeral: true });
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: "I couldn't send the message here.", ephemeral: true });
        }
    }
};
