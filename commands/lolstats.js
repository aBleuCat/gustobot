const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lolstats')
        .setDescription('Shows how many times the bot has said lol'),

    async execute(interaction) {
        // Access the LolStats model we defined in index.js
        const LolStats = mongoose.model('LolStats');
        const stats = await LolStats.findOne({ id: "global_stats" });

        if (!stats) {
            return interaction.reply("No lols have been recorded in the database yet!");
        }

        const embed = new EmbedBuilder()
            .setColor(0xffea00)
            .setTitle("LOL Counter")
            .addFields(
                { name: "Today", value: `${stats.daily}`, inline: true },
                { name: "This Week", value: `${stats.weekly}`, inline: true },
                { name: "All Time", value: `${stats.allTime}`, inline: true }
            )
            .setFooter({ 
                text: `Last lol: ${stats.lastTimestamp ? new Date(stats.lastTimestamp).toLocaleString() : 'Never'}` 
            });

        await interaction.reply({ embeds: [embed] });
    },
};
