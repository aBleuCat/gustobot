import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChatInputCommandInteraction } from 'discord.js';
import mongoose from 'mongoose';

export default {
    data: new SlashCommandBuilder()
        .setName('autoroleremove')
        .setDescription('Remove an autorole trigger by its ID')
        .addStringOption((option: any) => 
            option.setName('id')
                .setDescription('The 6-digit ID of the rule')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const id = interaction.options.getString('id');
        
        const Rule = mongoose.model('Rule');

        const result = await Rule.deleteOne({ ruleId: id });

        if (result.deletedCount === 0) {
            await interaction.reply({ 
                content: `Could not find a rule with ID \`${id}\` in the database.`, 
                flags: MessageFlags.Ephemeral 
            });
            return;
        }

        await interaction.reply({ 
            content: `Rule \`${id}\` has been removed from the cloud database.`, 
            flags: MessageFlags.Ephemeral 
        });
    }
};
