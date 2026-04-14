import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction } from 'discord.js';
import mongoose from 'mongoose';

export default {
    data: new SlashCommandBuilder()
        .setName('do')
        .setDescription('Tell the bot to do something')
        .addStringOption((opt: any) => opt.setName('action').setDescription('What should I do?').setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const actionInput = interaction.options.getString('action')!.toLowerCase();
        const ActionResponse = mongoose.model('ActionResponse');
        
        const allActions = await ActionResponse.find({});
        const matched = allActions.find((entry: any) => actionInput.includes(entry.trigger.toLowerCase()));

        if (matched) {
            await interaction.reply(`> **Request:** ${actionInput}\n${matched.response}`);
        }

        const dumbReasons = [
            "I would, but I just sat down and my legs are asleep",
            "I'm gooning rn try again later",
            "I'm doing the gizmos rn",
            "I don't like you, so no",
            "You're a fucking racist, get away from me",
            "I'm on strike rn, no can do",
            "I would, but actually no, I wouldn't, would never, go away, never come back",
            "Nah you got that",
            "Too busy not doing my learning log",
            "I would, but it's too far away"
        ];
        
        const randomReason = dumbReasons[Math.floor(Math.random() * dumbReasons.length)];
        await interaction.reply(`> **Request:** ${actionInput}\n${randomReason}`);
    }
};
