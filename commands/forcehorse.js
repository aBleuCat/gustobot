const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const mongoose = require('mongoose');
const HORSE_VALUES = require('../horses.json');
const UserHorses = mongoose.model('UserHorses');

const horseChoices = Object.entries(HORSE_VALUES).map(([slug, data]) => ({
    name: data.name,
    value: slug
}));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('forcehorse')
        .setDescription('Owner Only: Give a user a horse or a rare creature')
        .addUserOption(o => o.setName('target').setDescription('The user to receive the item').setRequired(true))
        .addStringOption(o => o.setName('type').setDescription('The type').setRequired(true)
            .addChoices(...horseChoices.slice(0, 25)))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        if (interaction.user.id !== '934290747623096381') {
            return interaction.reply({ content: "You are not authorized to use this command.", ephemeral: true });
        }
        const target = interaction.options.getUser('target');
        const type = interaction.options.getString('type');
        let inventory = await UserHorses.findOne({ userId: target.id });
        if (!inventory) {
            inventory = new UserHorses({ userId: target.id, horses: new Map() });
        }
        const currentCount = inventory.horses.get(type) || 0;
        inventory.horses.set(type, currentCount + 1);
        
        await inventory.save();
        const horseDisplay = HORSE_VALUES[type]?.name ?? type;
        await interaction.reply({ 
            content: `<@${target.id}> has magically obtained a **${horseDisplay}**`, 
            ephemeral: false 
        });
        const horseData = HORSE_VALUES[type];
        if (horseData && horseData.link) {
            await interaction.channel.send(horseData.link);
        }
    }
};
