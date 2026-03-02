const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autorolechange')
        .setDescription('Owner Only: Configure autorole swap rules')
        .addUserOption(o => o.setName('watch').setDescription('The user whose mentions to watch').setRequired(true))
        .addUserOption(o => o.setName('target').setDescription('The user who will receive the role swap').setRequired(true))
        .addRoleOption(o => o.setName('add').setDescription('Role to give the target').setRequired(true))
        .addRoleOption(o => o.setName('restore').setDescription('Role to restore for the target').setRequired(true))
        .addIntegerOption(o => o.setName('duration').setDescription('Duration in minutes').setRequired(true))
        .addChannelOption(o => o.setName('channel').setDescription('The channel where this rule triggers').setRequired(true)),
    
    async execute(interaction) {
        // 1. Owner Check
        if (interaction.user.id !== '934290747623096381') {
            return interaction.reply({ content: "Owner only.", flags: [MessageFlags.Ephemeral] });
        }

        try {
            const Rule = mongoose.model('Rule');
            const watchUser = interaction.options.getUser('watch');
            const targetUser = interaction.options.getUser('target');
            const addRole = interaction.options.getRole('add');
            const restoreRole = interaction.options.getRole('restore');
            const duration = interaction.options.getInteger('duration');
            const targetChannel = interaction.options.getChannel('channel');

            // Generate a Rule ID since your autoroleview uses it
            const newRuleId = Math.floor(100000 + Math.random() * 900000).toString();

            // 2. Database Operation
            await Rule.findOneAndUpdate(
                { watchUser: watchUser.id, targetUser: targetUser.id, channel: targetChannel.id },
                { 
                    ruleId: newRuleId,
                    addRole: addRole.id, 
                    restoreRole: restoreRole.id, 
                    durationMs: duration * 60000 
                },
                { upsert: true }
            );

            return interaction.reply(`**Rule Set!** ID: \`${newRuleId}\`\n**Channel:** ${targetChannel}\n**Trigger:** When ${watchUser.username} mentions ${targetUser.username}\n**Action:** Swaps to ${addRole.name} for ${duration}m, then restores ${restoreRole.name}.`);

        } catch (error) {
            // 3. Error Reporting to Discord
            console.error(error);
            const errorMessage = `**Database/Execution Error:**\n\`\`\`js\n${error.message}\n\`\`\``;
            
            if (interaction.replied || interaction.deferred) {
                return interaction.followUp({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
            } else {
                return interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
            }
        }
    }
};
