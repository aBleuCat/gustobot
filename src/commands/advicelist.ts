import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import mongoose from 'mongoose';

export default {
    data: new SlashCommandBuilder()
        .setName('advicelist')
        .setDescription('Shows stored advice in pages (Admin Only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const Advice = mongoose.model('Advice');
        const advices = await Advice.find({});

        if (!advices.length) {
            await interaction.reply("The circle of advice is currently empty.");
            return;
        }

        const generateEmbed = (page: number) => {
            const start = page * 10;
            const current = advices.slice(start, start + 10);
            
            const embed = new EmbedBuilder()
                .setTitle(`📜 Stored Advice (Page ${page + 1}/${Math.ceil(advices.length / 10)})`)
                .setColor(0x00AE86)
                .setDescription(current.map((a: any, i: number) => `**${start + i + 1}.** ${a.content}`).join('\n') || "No more advice.");

            return embed;
        };

        const generateButtons = (page: number) => {
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
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
            flags: MessageFlags.Ephemeral
        });

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
