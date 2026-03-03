const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');
const HORSE_VALUES = require('../horses.json');
const horseChoices = Object.keys(HORSE_VALUES).map(name => ({
    name: name,
    value: name
}));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('givehorse')
        .setDescription('Give one of your horses to another user.')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user you want to give the horse to')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('horse')
                .setDescription('The horse you want to give')
                .setRequired(true)
                .addChoices(...horseChoices.slice(0, 25))),
    async execute(interaction) {
        const UserHorses = mongoose.model('UserHorses');
        const targetUser = interaction.options.getUser('target');
        const horseName = interaction.options.getString('horse');
        if (targetUser.id === interaction.user.id) {
            return interaction.reply({ 
                content: "You can't give a horse to yourself, silly.", 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        // Prevent giving to bots
        if (targetUser.bot) {
            return interaction.reply({ 
                content: "Bots don't know how to ride horses.", 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        // 1. Check Giver's Inventory
        let giverInv = await UserHorses.findOne({ userId: interaction.user.id });
        if (!giverInv || (giverInv.horses.get(horseName) || 0) <= 0) {
            return interaction.reply({ 
                content: `You don't have a **${horseName}** to give!`, 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        // 2. Check/Create Receiver's Inventory
        let receiverInv = await UserHorses.findOne({ userId: targetUser.id });
        if (!receiverInv) {
            receiverInv = new UserHorses({ userId: targetUser.id, horses: new Map() });
        }

        // 3. Perform the Transfer
        // Remove from giver
        giverInv.horses.set(horseName, giverInv.horses.get(horseName) - 1);
        // Add to receiver
        receiverInv.horses.set(horseName, (receiverInv.horses.get(horseName) || 0) + 1);

        // 4. Save both
        await giverInv.save();
        await receiverInv.save();

        await interaction.reply({ 
            content: `You gave your **${horseName}** to <@${targetUser.id}>!` 
        });
        
        // Optional: Log to mod channel
        if (interaction.client.logToModChannel) {
            interaction.client.logToModChannel(interaction.guild, `${interaction.user.tag} gave a ${horseName} to ${targetUser.tag}`);
        }
    }
};
