import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction } from 'discord.js';
import mongoose from 'mongoose';

export default {
    data: new SlashCommandBuilder()
        .setName('autorolechange')
        .setDescription('Owner Only: Configure autorole swap rules')
        .addUserOption((o: any) => o.setName('messager').setDescription('The user whose mentions to watch').setRequired(true))
        .addUserOption((o: any) => o.setName('target_user').setDescription('The user who will receive the role swap').setRequired(true))
        .addRoleOption((o: any) => o.setName('add_role').setDescription('Role to give the target').setRequired(true))
        .addRoleOption((o: any) => o.setName('restore_role').setDescription('Role to restore for the target').setRequired(true))
        .addIntegerOption((o: any) => o.setName('duration').setDescription('Duration in minutes').setRequired(true))
        .addChannelOption((o: any) => o.setName('channel').setDescription('The channel where this rule triggers').setRequired(true)),
    
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        if (interaction.user.id !== '934290747623096381') {
            await interaction.reply({ content: "Owner only.", flags: MessageFlags.Ephemeral });
            return;
        }

        try {
            const Rule = mongoose.model('Rule');

            const watchUser = interaction.options.getUser('messager');
            const targetUser = interaction.options.getUser('target_user');
            const addRole = interaction.options.getRole('add_role');
            const restoreRole = interaction.options.getRole('restore_role');
            const duration = interaction.options.getInteger('duration');
            const targetChannel = interaction.options.getChannel('channel');
            if (!watchUser || !targetUser || !addRole || !restoreRole || !targetChannel) {
                throw new Error("One or more options failed to send.");
            }

            const newRuleId = Math.floor(100000 + Math.random() * 900000).toString();

            await Rule.findOneAndUpdate(
                { watchUser: watchUser.id, targetUser: targetUser.id, channel: targetChannel.id },
                { 
                    ruleId: newRuleId,
                    addRole: addRole.id, 
                    restoreRole: restoreRole.id, 
                    durationMs: duration! * 60000 
                },
                { upsert: true }
            );

            await interaction.reply(`**Rule Set** ID: \`${newRuleId}\`\nIn ${targetChannel}, if **${watchUser.username}** mentions **${targetUser.username}**, they get **${addRole.name}** for ${duration}m before restoring to ${restoreRole.name}`);
            return;

        } catch (error: any) {
            console.error(error);
            await interaction.reply({ content: `**Error:** ${error.message}`, flags: MessageFlags.Ephemeral });
            return;
        }
    }
};
