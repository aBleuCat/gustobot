const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sayasme')
        .setDescription('Make the bot say something in this channel')
        .addStringOption(opt => opt.setName('message').setDescription('What should I say?').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const text = interaction.options.getString('message');
        await interaction.channel.send(text);
        return interaction.reply({ content: "Message sent.", ephemeral: true });
    }
};
