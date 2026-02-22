const { SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('do')
        .setDescription('Tell the bot to do something')
        .addStringOption(opt => opt.setName('action').setDescription('What should I do?').setRequired(true)),
    async execute(interaction) {
        const actionInput = interaction.options.getString('action').toLowerCase();
        const ActionResponse = mongoose.model('ActionResponse');
        
        // Check database for triggers
        const allActions = await ActionResponse.find({});
        const matched = allActions.find(entry => actionInput.includes(entry.trigger.toLowerCase()));

        if (matched) {
            return interaction.reply(matched.response);
        }

        // Default dumb reasons
        const dumbReasons = [
            "I would, but I just sat down and my legs are asleep",
            "I'm gooning rn try again later",
            "I'm doing the gizmos rn",
            "I don't like you, so no",
            "You're a fucking racist, get away from me",
            "I'm on strike rn, no can do",
            "I would, but actually no, I wouldn't, would never, go away, never come back",
            "Nah you got that"
        ];
        
        const randomReason = dumbReasons[Math.floor(Math.random() * dumbReasons.length)];
        return interaction.reply(randomReason);
    }
};
