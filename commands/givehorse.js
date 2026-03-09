const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');
const HORSE_VALUES = require('../horses.json');

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
                .setAutocomplete(true)),

    async autocomplete(interaction) {
        const UserHorses = mongoose.model('UserHorses');
        const focused = interaction.options.getFocused().toLowerCase();
        const inventory = await UserHorses.findOne({ userId: interaction.user.id });

        const choices = [];
        if (inventory?.horses) {
            for (const [name, count] of inventory.horses.entries()) {
                if (count > 0 && HORSE_VALUES[name]) {
                    choices.push({ name: `${name} (x${count})`, value: name });
                }
            }
        }

        const filtered = choices
            .filter(c => c.name.toLowerCase().includes(focused))
            .slice(0, 25);

        await interaction.respond(filtered);
    },

    async execute(interaction) {
        const UserHorses = mongoose.model('UserHorses');
        const targetUser = interaction.options.getUser('target');
        const horseName = interaction.options.getString('horse');
        const botId = interaction.client.user.id;

        if (targetUser.id === interaction.user.id) {
            return interaction.reply({ content: "You can't give a horse to yourself, duh.", flags: [MessageFlags.Ephemeral] });
        }

        if (targetUser.bot && targetUser.id !== botId) {
            return interaction.reply({ content: "Bots can't own horses! I think", flags: [MessageFlags.Ephemeral] });
        }

        let giverInv = await UserHorses.findOne({ userId: interaction.user.id });
        if (!giverInv || (giverInv.horses.get(horseName) || 0) <= 0) {
            return interaction.reply({ content: `You don't have a **${horseName}**!`, flags: [MessageFlags.Ephemeral] });
        }

        let receiverInv = await UserHorses.findOne({ userId: targetUser.id });
        if (!receiverInv) {
            receiverInv = new UserHorses({ userId: targetUser.id, horses: new Map() });
        }

        giverInv.horses.set(horseName, giverInv.horses.get(horseName) - 1);
        receiverInv.horses.set(horseName, (receiverInv.horses.get(horseName) || 0) + 1);
        await giverInv.save();
        await receiverInv.save();

        const msg = targetUser.id === botId
            ? `You offered a **${horseName}** to me! Nom nom nom.`
            : `You gave your **${horseName}** to <@${targetUser.id}>!`;
        await interaction.reply({ content: msg });

        if (interaction.client.logToModChannel) {
            interaction.client.logToModChannel(interaction.guild, `${interaction.user.tag} gave a ${horseName} to ${targetUser.tag}`);
        }
    }
};
