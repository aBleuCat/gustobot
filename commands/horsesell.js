const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');
const HORSE_VALUES = require('../horses.json');
const { config } = require('../lib/config');
const { devLog } = require('../lib/helpers/devLog');

function horseName(slug) {
    return HORSE_VALUES[slug]?.name ?? slug;
}
const SELL_PRICE = config.COMMON_SELL_PRICE;
module.exports = {
    data: new SlashCommandBuilder()
        .setName('horsesell')
        .setDescription('Sell a horse for horse coin')
        .addStringOption(o =>
            o.setName('horse').setDescription('The horse to sell').setRequired(true).setAutocomplete(true))
        .addIntegerOption(o =>
            o.setName('amount').setDescription('How many to sell').setRequired(false).setMinValue(1).setMaxValue(1000)),

    async autocomplete(interaction) {
        try {
            const UserHorses = mongoose.model('UserHorses');
            const focused = interaction.options.getFocused().toLowerCase();
            const inventory = await UserHorses.findOne({ userId: interaction.user.id });

            const choices = [];
            if (inventory?.horses) {
                for (const [slug, count] of inventory.horses.entries()) {
                    if (count > 0 && HORSE_VALUES[slug]) {
                        choices.push({ name: `${horseName(slug)} (x${count})`, value: slug });
                    }
                }
            }

            const filtered = choices
                .filter(c => c.name.toLowerCase().includes(focused))
                .slice(0, 25);

            await interaction.respond(filtered);
        } catch (err) {
            console.error('horsesell autocomplete error:', err);
            try { await interaction.respond([]); } catch {}
        }
    },

    async execute(interaction) {
        await interaction.deferReply();
        const UserHorses = mongoose.model('UserHorses');
        const horseSlug = interaction.options.getString('horse');
        const amount = interaction.options.getInteger('amount') || 1;

        if (!HORSE_VALUES[horseSlug]) {
            return interaction.editReply({ content: `That isn't a valid horse.`, flags: [MessageFlags.Ephemeral] });
        }

        let inventory = await UserHorses.findOne({ userId: interaction.user.id });
        if (!inventory || (inventory.horses.get(horseSlug) || 0) < amount) {
            return interaction.editReply({
                content: `You don't have ${amount > 1 ? `**${amount}x** ` : 'a '}**${horseName(horseSlug)}**!`,
                flags: [MessageFlags.Ephemeral]
            });
        }

        const horseValue = HORSE_VALUES[horseSlug].value;
        const coinsEarned = Math.max(1, Math.floor(horseValue * SELL_PRICE / 25)) * amount;
        inventory.horses.set(horseSlug, inventory.horses.get(horseSlug) - amount);
        inventory.horseCoins = (inventory.horseCoins || 0) + coinsEarned;
        await inventory.save();

        devLog(`/horsesell: ${interaction.user.tag} sold \`${amount}x\` ${horseName(horseSlug)} for ${coinsEarned} coins. New balance: ${inventory.horseCoins} coins.`);
        return interaction.editReply(
            `You sold ${amount > 1 ? `**${amount}x** ` : 'your '}**${horseName(horseSlug)}** for **${coinsEarned}** 🪙 Horse Coin${coinsEarned !== 1 ? 's' : ''}!`
        );
    }
};