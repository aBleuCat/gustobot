const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('orbitalcannon')
        .setDescription('use the orbital cannon')
        .setContexts([0, 1, 2]) 
        .setIntegrationTypes([0, 1]),

    async execute(interaction) {
        const orbitalId = '1114989970839576637';
        const isOrbital = interaction.user.id === orbitalId;

        if (!isOrbital) {
            return interaction.reply({ 
                content: `<@${interaction.user.id}> tried to use the orbital cannon but miserably failed.`
            });
        }

        try {
            return interaction.reply({ content: `<@${interaction.user.id}> used Orbital Strike Cannon` });
            interaction.channel.send("https://cdn.discordapp.com/attachments/1411174514846466180/1444459198342500423/llVuhDC.gif?ex=69aea4b5&is=69ad5335&hm=5c93193f4fe164cc2e8390cd03a08fd81bbf9632dcafaab019bea5210cc274a9&");
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: "I couldn't send the message here.", flags: [MessageFlags.Ephemeral] });
        }
    }
};
