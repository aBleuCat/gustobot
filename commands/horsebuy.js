const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');
const HORSE_VALUES = require('../horses.json');
const { config } = require('../lib/config');
const { devLog } = require('../lib/helpers/devLog');

const COMMON_SLUG = 'common_horse';
const COMMON_PRICE = config.COMMON_BUY_PRICE;

function horseName(slug) {
    return HORSE_VALUES[slug]?.name ?? slug;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('horsebuy')
        .setDescription('Buy common horses for Horse Coins')
        .addIntegerOption(o =>
            o.setName('count').setDescription('How many to buy').setRequired(false).setMinValue(1).setMaxValue(50)),

    async execute(interaction) {
        const UserHorses = mongoose.model('UserHorses');
        const count = interaction.options.getInteger('count') || 1;
        const totalCost = COMMON_PRICE * count;

        let inventory = await UserHorses.findOne({ userId: interaction.user.id });
        const currentCoins = inventory?.horseCoins || 0;

        if (currentCoins < totalCost) {
            return interaction.reply({
                content: `You need **${totalCost}** 🪙 Horse Coins to buy **${count}x** **${horseName(COMMON_SLUG)}**, but you only have **${currentCoins}**.`,
                flags: [MessageFlags.Ephemeral]
            });
        }

        if (!inventory) {
            inventory = new UserHorses({ userId: interaction.user.id, horses: new Map(), horseCoins: 0 });
        }

        inventory.horses.set(COMMON_SLUG, (inventory.horses.get(COMMON_SLUG) || 0) + count);
        inventory.horseCoins = currentCoins - totalCost;
        await inventory.save();

        const name = horseName(COMMON_SLUG);
        return interaction.reply(
            `You bought \`${count > 1 ? `**${count}x** ` : 'a '}**\`${name}** for **${totalCost}** 🪙 Horse Coin${totalCost !== 1 ? 's' : ''}\nBalance: **${inventory.horseCoins}** 🪙`
        );
    }
};