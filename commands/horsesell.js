const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');
const HORSE_VALUES = require('../horses.json');

const horseChoices = Object.keys(HORSE_VALUES)
    .filter(name => name !== 'Horse Coin')
    .map(name => ({ name, value: name }));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('horsesell')
        .setDescription('Sell a horse for horse coin')
        .addStringOption(o => o.setName('horse').setDescription('The horse to sell').setRequired(true)
            .addChoices(...horseChoices.slice(0, 25)))
        .addIntegerOption(o => o.setName('amount').setDescription('How many to sell').setRequired(false).setMinValue(1)),
    async execute(interaction) {
        const UserHorses = mongoose.model('UserHorses');
        const horseName = interaction.options.getString('horse');
        const amount = interaction.options.getInteger('amount') || 1;
        let inventory = await UserHorses.findOne({ userId: interaction.user.id });

        if (!inventory || (inventory.horses.get(horseName) || 0) < amount) {
            return interaction.reply({
                content: `You don't have ${amount > 1 ? `**${amount}x** ` : 'a '}**${horseName}**!`,
                flags: [MessageFlags.Ephemeral]
            });
        }

        const horseValue = HORSE_VALUES[horseName].value;
        const coinsEarned = Math.max(1, Math.floor(horseValue * 2 / 25)) * amount;

        inventory.horses.set(horseName, inventory.horses.get(horseName) - amount);
        inventory.horseCoins = (inventory.horseCoins || 0) + coinsEarned;
        await inventory.save();

        return interaction.reply(
            `You sold ${amount > 1 ? `**${amount}x** ` : 'your '}**${horseName}** for **${coinsEarned}** 🪙 Horse Coin${coinsEarned !== 1 ? 's' : ''}!`
        );
    }
};
