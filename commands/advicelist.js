const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('advicelist')
        .setDescription('Shows stored advice in pages (Admin Only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const Advice = mongoose.model('Advice');
        const advices = await Advice.find({});

        if (!advices.length) return interaction.reply("The circle of advice is currently empty.");

        const generateEmbed = (page) => {
            const start = page * 10;
            const current = advices.slice(start, start + 10);
            
            const embed = new EmbedBuilder()
                .setTitle(`📜 Stored Advice (Page ${page + 1}/${Math.ceil(advices.length / 10)})`)
                .setColor(0x00AE86)
                .setDescription(current.map((a, i) => `**${start + i + 1}.** ${a.content}`).join('\n') || "No more advice.");

            return embed;
        };

        const generateButtons = (page) => {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`adv_prev_${page}`)
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId(`adv_next_${page}`)
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled((page + 1) * 10 >= advices.length)
            );
            return row;
        };

        const response = await interaction.reply({
            embeds: [generateEmbed(0)],
            components: [generateButtons(0)],
            ephemeral: true
        });

        // Collector to handle button clicks
        const collector = response.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async i => {
            const [type, direction, currentPage] = i.customId.split('_');
            if (type !== 'adv') return;

            const newPage = direction === 'next' ? parseInt(currentPage) + 1 : parseInt(currentPage) - 1;
            
            await i.update({
                embeds: [generateEmbed(newPage)],
                components: [generateButtons(newPage)]
            });
        });
    }
};
