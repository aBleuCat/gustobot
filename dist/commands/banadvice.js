import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import mongoose from 'mongoose';
export default {
    data: new SlashCommandBuilder()
        .setName('banadvice')
        .setDescription('Bans or unbans a user from using the advicegive command (Owner Only)')
        .addUserOption((option) => option.setName('user')
        .setDescription('The user to ban/unban')
        .setRequired(true)),
    async execute(interaction) {
        if (interaction.user.id !== '934290747623096381') {
            await interaction.reply({
                content: 'You do not have permission to use this command.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }
        const AdviceBan = mongoose.model('AdviceBan');
        const target = interaction.options.getUser('user');
        try {
            const exists = await AdviceBan.findOne({ userId: target.id });
            if (exists) {
                await AdviceBan.deleteOne({ userId: target.id });
                await interaction.reply(`Unbanned **${target.username}** from giving advice.`);
                return;
            }
            else {
                await new AdviceBan({ userId: target.id }).save();
                await interaction.reply(`Banned **${target.username}** from giving advice.`);
                return;
            }
        }
        catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Error updating advice ban status.', flags: MessageFlags.Ephemeral });
            return;
        }
    },
};
//# sourceMappingURL=banadvice.js.map