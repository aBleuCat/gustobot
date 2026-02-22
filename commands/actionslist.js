const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
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

        const generateEmbed = (page) => {
            const start = page * 10;
            const current = actions.slice(start, start + 10);
            
            const embed = new EmbedBuilder()
                .setTitle(`🛠 Learned Actions (Page ${page + 1}/${Math.ceil(actions.length / 10)})`)
                .setColor(0xFFA500)
                .setDescription(current.map(act => `• **${act.trigger}** → ${act.response}`).join('\n'));

            return embed;
        };

        const generateButtons = (page) => {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`act_prev_${page}`)
                    .setLabel('⬅️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId(`act_next_${page}`)
                    .setLabel('➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled((page + 1) * 10 >= actions.length)
            );
        };

        const response = await interaction.reply({
            embeds: [generateEmbed(0)],
            components: [generateButtons(0)],
            ephemeral: true
        });

        const collector = response.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async i => {
            const [, direction, currentPage] = i.customId.split('_');
            const newPage = direction === 'next' ? parseInt(currentPage) + 1 : parseInt(currentPage) - 1;
            
            await i.update({
                embeds: [generateEmbed(newPage)],
                components: [generateButtons(newPage)]
            });
        });
    }
};
