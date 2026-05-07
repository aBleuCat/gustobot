const { SlashCommandBuilder } = require('discord.js');
const { config } = require('../lib/config');

const IMAGES = {
    // Example: "cat": "https://example.com/cat.gif",
    "nahyan": "https://i.imgur.com/tmyvHLF.png",
    "alvin": "https://cdn.discordapp.com/attachments/1448897193736933498/1485341427742408945/togif.gif ",
    "nathan": "https://cdn.discordapp.com/attachments/1448897193736933498/1485433542438813806/togif.gif "
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getimage')
        .setDescription('Get an image by name')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('The name of the image')
                .setRequired(true)
                .setAutocomplete(true)
        ),

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused();
        const choices = Object.keys(IMAGES);
        const filtered = choices.filter(choice => 
            choice.toLowerCase().includes(focused.value.toLowerCase())
        );
        await interaction.respond(
            filtered.map(choice => ({ name: choice, value: choice })).slice(0, 25)
        );
    },

    async execute(interaction) {
        const name = interaction.options.getString('name');
        const imageUrl = IMAGES[name];

        if (!imageUrl) {
            await interaction.reply(`Image "${name}" not found. Available: ${Object.keys(IMAGES).join(', ') || 'none'}`);
            return;
        }

        await interaction.reply(imageUrl);
    }
};