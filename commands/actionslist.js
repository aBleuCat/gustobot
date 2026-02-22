const { SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('actionslist')
        .setDescription('Shows all learned actions'),
    async execute(interaction) {
        if (interaction.user.id !== '934290747623096381') {
            return interaction.reply({ content: "Only the great .i.exist can view these.", ephemeral: true });
        }

        const ActionResponse = mongoose.model('ActionResponse');
        const actions = await ActionResponse.find({});

        if (!actions.length) return interaction.reply("I haven't learned any actions yet.");

        let header = "**Learned Actions:**\n";
        let footer = "\n**... and more (too many actions)**";
        let list = "";
        let truncated = false;

        for (const act of actions) {
            let entry = `• **${act.trigger}** → ${act.response}\n`;
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
