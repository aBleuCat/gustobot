const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('impregnate')
        .setDescription('impregnate someone')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('user to impregnate')
                .setRequired(true)),
    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const roleId = '1473123914531213532';
        
        try {
            const target = await interaction.guild.members.fetch(user.id).catch(() => null);
            if (!target) return interaction.reply({ content: 'Member not found.', flags: [MessageFlags.Ephemeral] });
            
            await target.roles.add(roleId);
            return interaction.reply(`impregnated ${target.user.username}.`);
        } catch (e) {
            return interaction.reply({ content: 'Failed to impregnate', flags: [MessageFlags.Ephemeral] });
        }
    },
};
