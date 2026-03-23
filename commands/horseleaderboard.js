const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');
const mongoose = require('mongoose');
const HORSE_VALUES = require('../horses.json');

const PAGE_SIZE = 10;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('horseleaderboard')
        .setDescription('View the richest horse collectors'),
    async execute(interaction) {
        await interaction.deferReply();
        const allUsers = await mongoose.model('UserHorses').find();
        const totalPossibleItems = Object.values(HORSE_VALUES).filter(v => v.comp !== false).length;

        const data = allUsers.map(u => {
            let worth = 0;
            let unique = 0;
            for (const [name, count] of u.horses) {
                if (count > 0) {
                    const horseData = HORSE_VALUES[name];
                    if (!horseData) continue;
                    worth += (horseData.value * count);
                    if (horseData.comp !== false) unique++;
                }
            }
            return {
                userId: u.userId,
                worth,
                horseCoins: u.horseCoins || 0,
                completion: Math.round((unique / totalPossibleItems) * 100)
            };
        });

        const worthSort = [...data].sort((a, b) => b.worth - a.worth);
        const compSort = [...data].sort((a, b) => b.completion - a.completion);
        const coinSort = [...data].sort((a, b) => b.horseCoins - a.horseCoins);

        const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
        let currentPage = 0;
        const userCache = new Map();

        const getUserName = async (userId) => {
            if (userCache.has(userId)) return userCache.get(userId);
            const user = await interaction.client.users.fetch(userId).catch(() => null);
            const name = user ? user.displayName : 'Unknown User';
            userCache.set(userId, name);
            return name;
        };

        const buildList = async (list, type, page) => {
            const start = page * PAGE_SIZE;
            const current = list.slice(start, start + PAGE_SIZE);
            let str = '';

            for (let i = 0; i < current.length; i++) {
                const item = current[i];
                const name = await getUserName(item.userId);
                const rank = start + i + 1;
                const val = type === 'worth'
                    ? `$${item.worth.toLocaleString()}`
                    : (type === 'coins' ? `${item.horseCoins.toLocaleString()} 🪙` : `${item.completion}%`);
                str += `**${rank}.** ${name}: ${val}\n`;
            }

            return str || 'No data.';
        };

        const buildEmbed = async (page) => {
            return new EmbedBuilder()
                .setTitle(`🐎 Horse Collector Leaderboards (Page ${page + 1}/${totalPages})`)
                .setColor('#f1c40f')
                .addFields(
                    { name: '💰 Horse Net Worth', value: await buildList(worthSort, 'worth', page), inline: true },
                    { name: '🏆 Completion', value: await buildList(compSort, 'comp', page), inline: true },
                    { name: '🪙 Horse Coins', value: await buildList(coinSort, 'coins', page), inline: true }
                );
        };

        const getButtons = (page) => new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`hlb_prev_${page}`)
                .setLabel('⬅️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId(`hlb_next_${page}`)
                .setLabel('➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page >= totalPages - 1)
        );

        await interaction.editReply({
            embeds: [await buildEmbed(currentPage)],
            components: [getButtons(currentPage)]
        });

        const reply = await interaction.fetchReply();
        const collector = reply.createMessageComponentCollector({ time: 120000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                await i.reply({
                    content: 'Only the command user can use these buttons.',
                    flags: [MessageFlags.Ephemeral]
                }).catch(() => {});
                return;
            }

            const [, direction, page] = i.customId.split('_');
            const parsedPage = Number(page);
            currentPage = direction === 'next' ? parsedPage + 1 : parsedPage - 1;

            await i.update({
                embeds: [await buildEmbed(currentPage)],
                components: [getButtons(currentPage)]
            });
        });

        collector.on('end', async () => {
            await interaction.editReply({
                embeds: [await buildEmbed(currentPage)],
                components: []
            }).catch(() => {});
        });
    }
};
