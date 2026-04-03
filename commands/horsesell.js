const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');
const HORSE_VALUES = require('../horses.json');
const { config } = require('../lib/config');
const { devLog } = require('../lib/helpers/devLog');

function horseName(slug) {
    return HORSE_VALUES[slug]?.name ?? slug;
}
const SELL_PRICE = config.COMMON_SELL_PRICE;

// Returns [{slug, value, count}] sorted by value — does NOT expand by count to avoid OOM
function getSortedHorseList(inventory, sortDir = 'asc') {
    const list = [];
    for (const [slug, count] of inventory.horses.entries()) {
        if (count > 0 && HORSE_VALUES[slug]) {
            list.push({ slug, value: HORSE_VALUES[slug].value, count });
        }
    }
    list.sort((a, b) => sortDir === 'asc' ? a.value - b.value : b.value - a.value);
    return list;
}

function coinValueForSlug(slug) {
    const horseValue = HORSE_VALUES[slug].value;
    return Math.max(1, Math.floor(horseValue * SELL_PRICE / 25));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('horsesell')
        .setDescription('Sell a horse for horse coin')
        .addStringOption(o =>
            o.setName('horse').setDescription('The horse to sell, "top", or "bottom"').setRequired(true).setAutocomplete(true))
        .addIntegerOption(o =>
            o.setName('amount').setDescription('How many to sell (0 = all of that horse, or all top/bottom)').setRequired(false).setMinValue(0)),

    async autocomplete(interaction) {
        try {
            const UserHorses = mongoose.model('UserHorses');
            const focused = interaction.options.getFocused().toLowerCase();
            const inventory = await UserHorses.findOne({ userId: interaction.user.id });

            const choices = [
                { name: '📈 top — sell most valuable horses', value: 'top' },
                { name: '📉 bottom — sell least valuable horses', value: 'bottom' },
            ];
            if (inventory?.horses) {
                for (const [slug, count] of inventory.horses.entries()) {
                    if (count > 0 && HORSE_VALUES[slug]) {
                        choices.push({ name: `${horseName(slug)} (x${count})`, value: slug });
                    }
                }
            }

            await interaction.respond(
                choices.filter(c => c.name.toLowerCase().includes(focused)).slice(0, 25)
            );
        } catch (err) {
            console.error('horsesell autocomplete error:', err);
            try { await interaction.respond([]); } catch {}
        }
    },

    async execute(interaction) {
        await interaction.deferReply();
        const UserHorses = mongoose.model('UserHorses');
        const horseSlug = interaction.options.getString('horse');
        const amount = interaction.options.getInteger('amount') ?? 1;
        const isTop = horseSlug === 'top';
        const isBottom = horseSlug === 'bottom';
        const isTopBottom = isTop || isBottom;

        let inventory = await UserHorses.findOne({ userId: interaction.user.id });
        if (!inventory) {
            return interaction.editReply({ content: `You don't have any horses!`, flags: [MessageFlags.Ephemeral] });
        }

        // top/bottom bulk sell
        if (isTopBottom) {
            const sorted = getSortedHorseList(inventory, isTop ? 'desc' : 'asc');
            if (sorted.length === 0) {
                return interaction.editReply({ content: `You don't have any horses to sell!`, flags: [MessageFlags.Ephemeral] });
            }

            // Walk sorted slugs, taking up to `amount` total horses across slugs
            const sellMap = new Map();
            let remaining = amount === 0 ? Infinity : amount;
            for (const { slug, count } of sorted) {
                if (remaining <= 0) break;
                const take = amount === 0 ? count : Math.min(count, remaining);
                sellMap.set(slug, take);
                remaining -= take;
            }

            const totalTaken = [...sellMap.values()].reduce((a, b) => a + b, 0);
            let totalCoins = 0;
            for (const [slug, cnt] of sellMap.entries()) {
                inventory.horses.set(slug, (inventory.horses.get(slug) || 0) - cnt);
                totalCoins += coinValueForSlug(slug) * cnt;
            }
            inventory.horseCoins = (inventory.horseCoins || 0) + totalCoins;
            inventory.markModified('horses');
            await inventory.save();

            const label = isTop ? 'most valuable' : 'least valuable';
            const lines = [...sellMap.entries()]
                .sort((a, b) => (HORSE_VALUES[b[0]]?.value ?? 0) - (HORSE_VALUES[a[0]]?.value ?? 0))
                .map(([slug, cnt]) => `* ${cnt}x **${horseName(slug)}** → ${coinValueForSlug(slug) * cnt} 🪙`)
                .join('\n');

            devLog(`/horsesell: ${interaction.user.tag} sold ${totalTaken} ${label} horses for ${totalCoins} coins.`);
            return interaction.editReply(
                `Sold **${totalTaken}** ${label} horse${totalTaken !== 1 ? 's' : ''} for **${totalCoins}** 🪙 total!\n${lines}`
            );
        }

        // single horse type sell
        if (!HORSE_VALUES[horseSlug]) {
            return interaction.editReply({ content: `That isn't a valid horse.`, flags: [MessageFlags.Ephemeral] });
        }

        const owned = inventory.horses.get(horseSlug) || 0;
        const sellAmount = amount === 0 ? owned : amount;

        if (owned < sellAmount || sellAmount <= 0) {
            return interaction.editReply({
                content: `You don't have ${sellAmount > 1 ? `**${sellAmount}x** ` : 'a '}**${horseName(horseSlug)}**!`,
                flags: [MessageFlags.Ephemeral]
            });
        }

        const coinsEarned = coinValueForSlug(horseSlug) * sellAmount;
        inventory.horses.set(horseSlug, owned - sellAmount);
        inventory.horseCoins = (inventory.horseCoins || 0) + coinsEarned;
        await inventory.save();

        devLog(`/horsesell: ${interaction.user.tag} sold \`${sellAmount}x\` ${horseName(horseSlug)} for ${coinsEarned} coins. New balance: ${inventory.horseCoins} coins.`);
        return interaction.editReply(
            `You sold ${sellAmount > 1 ? `**${sellAmount}x** ` : 'your '}**${horseName(horseSlug)}** for **${coinsEarned}** 🪙 Horse Coin${coinsEarned !== 1 ? 's' : ''}!`
        );
    }
};