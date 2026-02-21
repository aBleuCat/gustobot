const { SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('advicegive')
        .setDescription('Add a piece of advice to the goon circle of advice')
        .setContexts([0, 1, 2]) 
        .setIntegrationTypes([0, 1]) 
        .addStringOption(option => 
            option.setName('text')
                .setDescription('The advice you want to give')
                .setRequired(true)),

    async execute(interaction) {
        const Advice = mongoose.model('Advice');
        const text = interaction.options.getString('text');

        const newAdvice = new Advice({
            content: text,
            authorId: interaction.user.id
        });

        await newAdvice.save();
        await interaction.reply({ content: 'Your wisdom shall be propagated', ephemeral: true });
    },
};
