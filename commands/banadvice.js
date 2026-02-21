const { SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('banadvice')
        .setDescription('Bans or unbans a user from using the advicegive command (Owner Only)')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to ban/unban')
                .setRequired(true)),

    async execute(interaction) {
        // Owner ID Check
        if (interaction.user.id !== '934290747623096381') {
            return interaction.reply({ 
                content: 'You do not have permission to use this command.', 
                ephemeral: true 
            });
        }

        const AdviceBan = mongoose.model('AdviceBan');
        const target = interaction.options.getUser('user');

        try {
            const exists = await AdviceBan.findOne({ userId: target.id });

            if (exists) {
                await AdviceBan.deleteOne({ userId: target.id });
                return interaction.reply(`Unbanned **${target.username}** from giving advice.`);
            } else {
                await new AdviceBan({ userId: target.id }).save();
                return interaction.reply(`Banned **${target.username}** from giving advice.`);
            }
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: 'Error updating advice ban status.', ephemeral: true });
        }
    },
};
