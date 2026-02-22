const { SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('howtoact')
        .setDescription('Teach the bot how to respond to an action')
        .addStringOption(opt => opt.setName('trigger').setDescription('The word to look for').setRequired(true))
        .addStringOption(opt => opt.setName('response').setDescription('The bot response').setRequired(true)),
    async execute(interaction) {
        if (interaction.user.id !== '934290747623096381') {
            return interaction.reply({ content: "You can't do that brochacho", ephemeral: true });
        }

        const ActionResponse = mongoose.model('ActionResponse');
        const trigger = interaction.options.getString('trigger');
        const response = interaction.options.getString('response');

        await ActionResponse.findOneAndUpdate(
            { trigger: trigger.toLowerCase() },
            { response: response },
            { upsert: true }
        );

        return interaction.reply({ content: `Ok sir, when someone says **${trigger}**, I'll say **${response}**`, ephemeral: true });
    }
};
