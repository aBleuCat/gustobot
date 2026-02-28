const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const mongoose = require('mongoose');

const UserHorses = mongoose.model('UserHorses');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('forcehorse')
        .setDescription('Owner Only: Give a user a horse or a rare creature')
        .addUserOption(o => o.setName('target').setDescription('The user to receive the item').setRequired(true))
        .addStringOption(o => o.setName('type').setDescription('The type').setRequired(true)
            .addChoices(
                { name: 'Truth and Affirmation', value: 'Horse of Truth and Affirmation' },
                { name: 'Patience and Wisdom', value: 'Horse of Patience and Wisdom' },
                { name: 'Comfort and Relaxation', value: 'Horse of Comfort and Relaxation' },
                { name: 'Lies and Deceit', value: 'Horse of Lies and Deceit' },
                { name: 'Despair and Agony', value: 'Horse of Despair and Agony' },
                { name: 'Ultra-Rare Dung Beetle', value: 'Dung Beetle' }
            ))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        // RESTRICT TO ME ONLY
        if (interaction.user.id !== '934290747623096381') {
            return interaction.reply({ content: "You are not authorized to use this command.", ephemeral: true });
        }

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
            content: `<@${target.id}> has magically obtained a **${type}**`, 
            ephemeral: false 
        });
    }
};
