const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const mongoose = require('mongoose');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('advicelist')
        .setDescription('Shows stored advice (Admin Only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const Advice = mongoose.model('Advice');
        const advices = await Advice.find({});

        if (!advices.length) return interaction.reply("The goon circle of advice is currently empty.");

        let header = "**Stored Advice:**\n";
        let footer = "\n*...and more (list truncated due to length)*";
        let list = "";
        let truncated = false;

        for (let i = 0; i < advices.length; i++) {
            let entry = `${i + 1}. ${advices[i].content}\n`;
            // Check if adding this entry + the footer exceeds 2000
            if ((header + list + entry + footer).length > 2000) {
                truncated = true;
                break;
            }
            list += entry;
        }

        return interaction.reply({ 
            content: header + list + (truncated ? footer : ""), 
            ephemeral: true 
        });
    }
};
