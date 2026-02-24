const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('scream')
        .setDescription('moves the eternal screaming to a specific channel')
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('the voice channel to haunt')
                .setRequired(true)),
    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        // type 2 is voice
        if (!channel || channel.type !== 2) {
            return interaction.reply({ content: 'Valid VC only.', flags: [MessageFlags.Ephemeral] });
        }

        // Access the playScream function attached to client in index.js
        interaction.client.playScream(interaction.guild, channel.id);
        
        return interaction.reply(`The eternal screaming moved to **${channel.name}**.`);
    },
};
