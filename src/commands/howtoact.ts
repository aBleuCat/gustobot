import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction } from 'discord.js';
import mongoose from 'mongoose';

export default {
    data: new SlashCommandBuilder()
        .setName('howtoact')
        .setDescription('Teach the bot how to respond to an action')
        .addStringOption((opt: any) => opt.setName('trigger').setDescription('The word to look for').setRequired(true))
        .addStringOption((opt: any) => opt.setName('response').setDescription('The bot response').setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        if (interaction.user.id !== '934290747623096381') {
            await interaction.reply({ content: "You can't do that brochacho", flags: MessageFlags.Ephemeral });
        }

        const ActionResponse = mongoose.model('ActionResponse');
        const trigger = interaction.options.getString('trigger');
        const response = interaction.options.getString('response');

        await ActionResponse.findOneAndUpdate(
            { trigger: trigger!.toLowerCase() },
            { response: response },
            { upsert: true }
        );

        await interaction.reply({ content: `Ok sir, when someone says **${trigger}**, I'll say **${response}**`, flags: MessageFlags.Ephemeral });
    }
};
