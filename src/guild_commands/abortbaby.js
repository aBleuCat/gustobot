const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('abortbaby')
        .setDescription('Abortion is still legal here dw'),
    async execute(interaction) {
        const roleId = '1473123914531213532';
        try {
            await interaction.member.roles.remove(roleId);
            return interaction.reply({ content: 'Baby aborted' });
        } catch (e) {
            return interaction.reply({ content: 'I couldn\'t abort the baby for you', ephemeral: true });
        }
    },
};
