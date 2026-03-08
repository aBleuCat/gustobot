const { SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');
const HORSE_VALUES = require('../horses.json');

const OWNER_ID = '934290747623096381';

const horseChoices = Object.keys(HORSE_VALUES).map(name => ({
    name: name,
    value: name
}));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('replacehorses')
        .setDescription('Replace everyone\'s horse of one type with another (owner only)')
        .addStringOption(o =>
            o.setName('horse')
             .setDescription('The horse to replace')
             .setRequired(true))
        .addStringOption(o =>
            o.setName('replacement')
             .setDescription('The horse to replace it with')
             .setRequired(true)
             .addChoices(...horseChoices.slice(0, 25))),

    async execute(interaction) {
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: 'no can do', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const UserHorses = mongoose.model('UserHorses');
        const horse       = interaction.options.getString('horse');
        const replacement = interaction.options.getString('replacement');

        const allUsers = await UserHorses.find({});
        let affectedUsers = 0;
        let totalReplaced = 0;

        for (const user of allUsers) {
            const count = user.horses.get(horse) || 0;
            if (count <= 0) continue;

            user.horses.set(horse, 0);
            user.horses.set(replacement, (user.horses.get(replacement) || 0) + count);
            await user.save();

            affectedUsers++;
            totalReplaced += count;
        }

        return interaction.editReply(
            `Replaced **${totalReplaced}x ${horse}** with **${replacement}** across **${affectedUsers}** user(s).`
        );
    },
};
