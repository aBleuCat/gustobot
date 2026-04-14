import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ChatInputCommandInteraction } from 'discord.js';
import mongoose from 'mongoose';
import HORSE_VALUES from '../horses.json' assert { type: 'json' };

const PAGE_SIZE = 10;

export default {
    data: new SlashCommandBuilder()
        .setName('horseleaderboard')
        .setDescription('View the richest horse collectors')
        .addIntegerOption((opt: any) =>
            opt.setName('page')
                .setDescription('Page number to view (starts at 1)')
                .setMinValue(1)
        ),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();
        const UserHorses = mongoose.model('UserHorses');
        const allUsers = await UserHorses.find({}, { userId: 1, horses: 1, horseCoins: 1 });
        const totalPossibleItems = Object.values(HORSE_VALUES).filter((v: any) => v.comp !== false).length;

        const data = allUsers.map((u: any) => {
            let worth = 0;
            let unique = 0;
            for (const [name, count] of u.horses) {
                if (count > 0) {
                    const horseData: any = HORSE_VALUES[name as keyof typeof HORSE_VALUES];
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

        const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
        let currentPage = (interaction.options.getInteger('page') || 1) - 1;
        if (currentPage < 0) currentPage = 0;
        if (currentPage >= totalPages) currentPage = totalPages - 1;

        const embed = new EmbedBuilder()
            .setTitle(`🐎 Horse Collector Leaderboards (Page ${currentPage + 1}/${totalPages})`)
            .setColor('#f1c40f')
            .setDescription(`Top horse collectors by wealth. Page ${currentPage + 1} of ${totalPages}.`);

        await interaction.editReply({
            embeds: [embed]
        });
    }
};
