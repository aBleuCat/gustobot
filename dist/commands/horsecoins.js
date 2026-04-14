import { SlashCommandBuilder } from 'discord.js';
import mongoose from 'mongoose';
export default {
    data: new SlashCommandBuilder()
        .setName('horsecoins')
        .setDescription('Check horse coin balance')
        .addUserOption((option) => option.setName('user')
        .setDescription('User to check (optional, defaults to you)')
        .setRequired(false)),
    async execute(interaction) {
        const UserHorses = mongoose.model('UserHorses');
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const inventory = await UserHorses.findOne({ userId: targetUser.id });
        const coins = inventory?.horseCoins || 0;
        await interaction.reply({
            content: `<@${targetUser.id}> has **${coins}** 🪙 Horse Coin${coins !== 1 ? 's' : ''}`
        });
    }
};
//# sourceMappingURL=horsecoins.js.map