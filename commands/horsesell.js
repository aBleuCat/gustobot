const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');
const HORSE_VALUES = require('../horses.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('horsesell')
        .setDescription('Sell a horse for horse coin')
        .addStringOption(o =>
            o.setName('horse').setDescription('The horse to sell').setRequired(true).setAutocomplete(true))
        .addIntegerOption(o =>
            o.setName('amount').setDescription('How many to sell').setRequired(false).setMinValue(1)),

    async autocomplete(interaction) {
        const UserHorses = mongoose.model('UserHorses');
        const focused = interaction.options.getFocused().toLowerCase();
        const inventory = await UserHorses.findOne({ userId: interaction.user.id });

        const choices = [];
        if (inventory?.horses) {
            for (const [name, count] of inventory.horses.entries()) {
                if (count > 0 && HORSE_VALUES[name] && name !== 'Horse Coin') {
                    choices.push({ name: `${name} (x${count})`, value: name });
                }
            }
        }

        const filtered = choices
            .filter(c => c.name.toLowerCase().includes(focused))
            .slice(0, 25);

        await interaction.respond(filtered);
    },

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
