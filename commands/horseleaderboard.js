const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');

const UserHorses = mongoose.model('UserHorses');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('horseleaderboard')
        .setDescription('View the richest horse collectors'),
    async execute(interaction) {
        await interaction.deferReply();

        const allUsers = await UserHorses.find();
        const itemValues = { "Dung Beetle": 125, "default": 75 };
        const totalItems = 6;

        const data = allUsers.map(u => {
            let worth = 0;
            let unique = 0;
            for (const [name, count] of u.horses) {
                if (count > 0) {
                    worth += ((itemValues[name] || itemValues.default) * count);
                    unique++;
                }
            }
            return { userId: u.userId, worth, completion: Math.round((unique / totalItems) * 100) };
        });

        const worthSort = [...data].sort((a, b) => b.worth - a.worth).slice(0, 10);
        const compSort = [...data].sort((a, b) => b.completion - a.completion).slice(0, 10);

        const buildList = async (list, type) => {
            let str = "";
            for (let i = 0; i < list.length; i++) {
                const user = await interaction.client.users.fetch(list[i].userId).catch(() => null);
                const name = user ? user.displayName : "Unknown User";
                const val = type === 'worth' ? `$${list[i].worth}` : `${list[i].completion}%`;
                str += `**${i + 1}.** ${name}: ${val}\n`;
            }
            return str || "No data.";
        };

        const embed = new EmbedBuilder()
            .setTitle('🐎 Horse Collector Leaderboards')
            .setColor('#f1c40f')
            .addFields(
                { name: '💰 Net Worth', value: await buildList(worthSort, 'worth'), inline: true },
                { name: '🏆 Completion', value: await buildList(compSort, 'comp'), inline: true }
            );

        return interaction.editReply({ embeds: [embed] });
    }
};
