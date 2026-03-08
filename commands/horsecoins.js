const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coincount')
        .setDescription('Check your horse coin balance'),
    async execute(interaction) {
        const UserHorses = mongoose.model('UserHorses');
        const inventory = await UserHorses.findOne({ userId: interaction.user.id });
        const coins = inventory?.horseCoins || 0;

        return interaction.reply({
            content: `You have **${coins}** 🪙 Horse Coin${coins !== 1 ? 's' : ''}`
        });
    }
};
