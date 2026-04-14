import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import mongoose from 'mongoose';
export default {
    data: new SlashCommandBuilder()
        .setName('forcecoins')
        .setDescription('Owner Only: Give horse coins to a user')
        .addUserOption((o) => o.setName('target').setDescription('The user to receive coins').setRequired(true))
        .addIntegerOption((o) => o.setName('amount').setDescription('How many coins to give').setRequired(true).setMinValue(1))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        if (interaction.user.id !== '934290747623096381') {
            await interaction.reply({ content: `You are not authorized to use this command.`, flags: MessageFlags.Ephemeral });
        }
        const UserHorses = mongoose.model('UserHorses');
        const target = interaction.options.getUser('target');
        const amount = interaction.options.getInteger('amount');
        let inventory = await UserHorses.findOne({ userId: target.id });
        if (!inventory)
            inventory = new UserHorses({ userId: target.id, horses: new Map() });
        inventory.horseCoins = (inventory.horseCoins || 0) + amount;
        await inventory.save();
        await interaction.reply(`<@${target.id}> has been given **${amount}** 🪙 Horse Coin${amount !== 1 ? 's' : ''}!`);
    }
};
//# sourceMappingURL=forcecoins.js.map