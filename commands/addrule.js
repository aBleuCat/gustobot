const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');
console.log(interaction.options._hoistedOptions);
module.exports = {
    data: new SlashCommandBuilder()
        .setName('autorolechange')
        .setDescription('Add a role trigger rule')
        .addUserOption(o => o.setName('messager').setDescription('Trigger user').setRequired(true))
        .addUserOption(o => o.setName('target_user').setDescription('User to swap').setRequired(true))
        .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true))
        .addRoleOption(o => o.setName('add_role').setDescription('Temporary role').setRequired(true))
        .addRoleOption(o => o.setName('restore_role').setDescription('Role to return').setRequired(true))
        .addIntegerOption(o => o.setName('duration').setDescription('Hours').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        try {
            // These MUST match the "name" fields in your log exactly
            const messager = interaction.options.getUser('messager');
            const target = interaction.options.getUser('target_user'); // Fixed
            const channel = interaction.options.getChannel('channel');
            const addRole = interaction.options.getRole('add_role');    // Fixed
            const restoreRole = interaction.options.getRole('restore_role'); // Fixed
            const duration = interaction.options.getInteger('duration');

            // Log it to your console just to be sure
            console.log(`Attempting to save: Messager: ${messager?.id}, Target: ${target?.id}`);

            if (!messager || !target || !channel || !addRole || !restoreRole) {
                return interaction.editReply({ 
                    content: '❌ Name mismatch detected! Check the bot logs for the correct option names.' 
                });
            }

            const Rule = mongoose.model('Rule');
            const newRule = new Rule({
                ruleId: Date.now().toString().slice(-6),
                watchUser: messager.id,
                targetUser: target.id,
                channel: channel.id,
                addRole: addRole.id,
                restoreRole: restoreRole.id,
                durationMs: duration * 60 * 60 * 1000
            });

            await newRule.save();

            await interaction.editReply({ 
                content: `✅ **Rule Saved!** ID: \`${newRule.ruleId}\`\nWatching <@${messager.id}> in <#${channel.id}>.` 
            });

        } catch (error) {
            console.error('Database Error:', error);
            await interaction.editReply({ content: '❌ Database error! Is the Rule model defined in index.js?' });
        }
    }
            await newRule.save();

            // 3. Edit the original "thinking" message with the success info
            await interaction.editReply({ 
                content: `✅ **Rule Saved!** ID: \`${newRule.ruleId}\`\nWatching <@${messager.id}> in <#${channel.id}>.` 
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: '❌ Database error! Check Koyeb logs.' });
        }
    }
};
