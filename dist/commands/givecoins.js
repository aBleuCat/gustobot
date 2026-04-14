import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import mongoose from 'mongoose';
export default {
    data: new SlashCommandBuilder()
        .setName('givecoins')
        .setDescription('Give your horse coins to another user!')
        .addUserOption((o) => o.setName('target').setDescription('Who to give coins to').setRequired(true))
        .addIntegerOption((o) => o.setName('amount').setDescription('How many coins to give').setRequired(true).setMinValue(1)),
    async execute(interaction) {
        const UserHorses = mongoose.model('UserHorses');
        const target = interaction.options.getUser('target');
        const amount = interaction.options.getInteger('amount');
        if (target.id === interaction.user.id) {
            await interaction.reply({ content: `You can't give coins to yourself!`, flags: MessageFlags.Ephemeral });
        }
        if (target.bot) {
            await interaction.reply({ content: `You can't give coins to a bot!`, flags: MessageFlags.Ephemeral });
        }
        let sender = await UserHorses.findOne({ userId: interaction.user.id });
        if (sender && (sender.horseCoins || 0) < 0) {
            await interaction.reply({
                content: `You are in coin debt (**${sender.horseCoins}**). You can't give coins until you break even.`,
                flags: MessageFlags.Ephemeral
            });
        }
        if (!sender || (sender.horseCoins || 0) < amount) {
            await interaction.reply({ content: `You don't have **${amount}** 🪙 to give!`, flags: MessageFlags.Ephemeral });
        }
        let receiver = await UserHorses.findOne({ userId: target.id });
        if (!receiver)
            receiver = new UserHorses({ userId: target.id, horses: new Map() });
        sender.horseCoins -= amount;
        receiver.horseCoins = (receiver.horseCoins || 0) + amount;
        await sender.save();
        await receiver.save();
        await interaction.reply(`<@${interaction.user.id}> gave **${amount}** 🪙 Horse Coin${amount !== 1 ? 's' : ''} to <@${target.id}>!`);
    }
};
//# sourceMappingURL=givecoins.js.map