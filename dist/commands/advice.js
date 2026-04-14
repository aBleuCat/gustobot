import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import mongoose from 'mongoose';
export default {
    data: new SlashCommandBuilder()
        .setName('advice')
        .setDescription('Get advice for your question')
        .setContexts([0, 1, 2])
        .setIntegrationTypes([0, 1])
        .addStringOption((option) => option.setName('question')
        .setDescription('What do you need advice on?')
        .setRequired(true)),
    async execute(interaction) {
        const Advice = mongoose.model('Advice');
        const question = interaction.options.getString('question');
        const allAdvice = await Advice.find({});
        if (allAdvice.length === 0) {
            await interaction.reply({ content: "The database is empty! Use `/advicegive` to add some wisdom first.", ephemeral: true });
            return;
        }
        const randomAdvice = allAdvice[Math.floor(Math.random() * allAdvice.length)];
        const embed = new EmbedBuilder()
            .setTitle(`The Oracle Provides...`)
            .setColor('#6463FA')
            .addFields({ name: 'Your Question:', value: question || 'none' }, { name: 'Advice:', value: randomAdvice.content })
            .setFooter({ text: `Wise words of wisdom shared by a fellow user` });
        await interaction.reply({ embeds: [embed] });
    },
};
//# sourceMappingURL=advice.js.map