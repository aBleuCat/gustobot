const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lolstats')
        .setDescription('Shows how many times the bot has said lol'),

    async execute(interaction) {
        const LolStats = mongoose.model('LolStats');
        const stats = await LolStats.findOne({ id: "global_stats" });

        if (!stats || !stats.lastTimestamp) {
            return interaction.reply("No lols have been recorded in the database yet!");
        }

        // Convert stored MS to Unix Seconds for Discord's dynamic time
        const unixSeconds = Math.floor(stats.lastTimestamp / 1000);
        const discordTime = `<t:${unixSeconds}:f>`; // e.g., February 20, 2026 5:31 AM
        const relativeTime = `<t:${unixSeconds}:R>`; // e.g., 5 minutes ago

        const embed = new EmbedBuilder()
            .setColor(0xffea00)
            .setTitle("lol Counter")
            .addFields(
                { name: "Today", value: `${stats.daily}`, inline: true },
                { name: "This Week", value: `${stats.weekly}`, inline: true },
                { name: "All Time", value: `${stats.allTime}`, inline: true },
                { name: "Last Lol", value: `${discordTime} (${relativeTime})`, inline: false }
            );

        await interaction.reply({ embeds: [embed] });
    },
};
