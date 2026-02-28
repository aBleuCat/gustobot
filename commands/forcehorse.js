const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const mongoose = require('mongoose');

// Passive lookup
const UserHorses = mongoose.model('UserHorses');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('forcehorse')
        .setDescription('Give a user a horse')
        .addUserOption(o => o.setName('target').setDescription('The user to receive the horse').setRequired(true))
        .addStringOption(o => o.setName('type').setDescription('The horse type').setRequired(true)
            .addChoices(
                { name: 'Truth and Affirmation', value: 'Horse of Truth and Affirmation' },
                { name: 'Patience and Wisdom', value: 'Horse of Patience and Wisdom' },
                { name: 'Comfort and Relaxation', value: 'Horse of Comfort and Relaxation' },
                { name: 'Lies and Deceit', value: 'Horse of Lies and Deceit' },
                { name: 'Despair and Agony', value: 'Horse of Despair and Agony' }
            ))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const target = interaction.options.getUser('target');
        const type = interaction.options.getString('type');

        let inventory = await UserHorses.findOne({ userId: target.id });
        if (!inventory) {
            inventory = new UserHorses({ userId: target.id, horses: new Map() });
        }

        const currentCount = inventory.horses.get(type) || 0;
        inventory.horses.set(type, currentCount + 1);
        
        await inventory.save();

        return interaction.reply({ 
            content: `Succesfully gifted the **${type}** to <@${target.id}>.`, 
            ephemeral: false 
        });
    }
};
