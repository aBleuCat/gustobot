const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const mongoose = require('mongoose');
const HORSE_VALUES = require('../horses.json');
const UserHorses = mongoose.model('UserHorses');
const { conditionHorse } = require('../lib/helpers/horseFuncs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('forcehorse')
        .setDescription('Owner Only: Give a user a horse or a rare creature')
        .addUserOption(o => o.setName('target').setDescription('The user to receive the item').setRequired(true))
        .addStringOption(o => o 
            .setName('type')
            .setDescription('The type')
            .setRequired(true)
            .setAutocomplete(true)) // Enable autocomplete
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        
        // Filter horses based on the input
        const choices = Object.entries(HORSE_VALUES)
            .filter(([slug, data]) => 
                data.name.toLowerCase().includes(focusedValue) || 
                slug.toLowerCase().includes(focusedValue)
            )
            .map(([slug, data]) => ({
                name: data.name,
                value: slug
            }));

        // Discord limits autocomplete to 25 results
        await interaction.respond(choices.slice(0, 25)).catch(() => {});
    },

    async execute(interaction) {
        if (interaction.user.id !== '934290747623096381') {
            return interaction.reply({ content: "You are not authorized to use this command.", ephemeral: true });
        }

        const target = interaction.options.getUser('target');
        const type = interaction.options.getString('type');
        
        // Verify the horse type exists in our data
        const horseData = HORSE_VALUES[type];
        if (!horseData) {
            return interaction.reply({ content: "Invalid horse type selected.", ephemeral: true });
        }

        let inventory = await UserHorses.findOne({ userId: target.id });
        if (!inventory) {
            inventory = new UserHorses({ userId: target.id, horses: new Map() });
        }

        const currentCount = inventory.horses.get(type) || 0;
        inventory.horses.set(type, currentCount + 1);
        
        await inventory.save();

        const horseDisplay = horseData.name;
        await interaction.reply({ 
            content: `<@${target.id}> has magically obtained a **${horseDisplay}**`, 
            ephemeral: false 
        });

        if (horseData.link) {
            await interaction.channel.send(horseData.link);
        }

        await conditionHorse(inventory, interaction.channel);
    }
};