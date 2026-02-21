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
                .setDescription('The advice')
                .setRequired(true)),

    async execute(interaction) {
        const Advice = mongoose.model('Advice');
        const AdviceBan = mongoose.model('AdviceBan');
        const text = interaction.options.getString('text').trim();

        // 1. Check if the user is banned
        const isBanned = await AdviceBan.findOne({ userId: interaction.user.id });
        if (isBanned) {
            return interaction.reply({ 
                content: 'You are banned from contributing wisdom to the circle.', 
                ephemeral: true 
            });
        }

        // 2. Character limit check (100 chars)
        if (text.length > 100) {
            return interaction.reply({
                content: `That's too much wisdom! Please keep it under 100 characters (Current: ${text.length}).`,
                ephemeral: true
            });
        }
        
        if (text.length < 3) {
            return interaction.reply({
                content: 'Wisdom must be at least 3 characters long.',
                ephemeral: true
            });
        }

        // 3. Duplicate check (Case-insensitive)
        const existingAdvice = await Advice.findOne({ 
            content: { $regex: new RegExp(`^${text}$`, 'i') } 
        });

        if (existingAdvice) {
            return interaction.reply({ 
                content: 'This wisdom has already been propagated. Try something more original.', 
                ephemeral: true 
            });
        }

        // 4. Save
        try {
            const newAdvice = new Advice({
                content: text,
                authorId: interaction.user.id
            });
            await newAdvice.save();
            await interaction.reply({ content: 'Your wisdom shall be propagated', ephemeral: true });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Failed to save advice.', ephemeral: true });
        }
    },
};
