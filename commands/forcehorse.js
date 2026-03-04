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
                { name: 'Providence and All Knowing (1/2500)', value: 'Horse of Providence and All Knowing' },
                { name: 'Truth and Affirmation (1/750)', value: 'Horse of Truth and Affirmation' },
                { name: 'Patience and Wisdom (1/750)', value: 'Horse of Patience and Wisdom' },
                { name: 'Comfort and Relaxation (1/750)', value: 'Horse of Comfort and Relaxation' },
                { name: 'Lies and Deceit (1/750)', value: 'Horse of Lies and Deceit' },
                { name: 'Despair and Agony (1/750)', value: 'Horse of Despair and Agony' },
                { name: 'Suspicion and Distrust (1/750)', value: 'Horse of Suspicion and Distrust' },
                { name: 'Commonosity and Normaltude (1/200)', value: 'Horse of Commonosity and Normaltude' },
                { name: 'Dung Beetle (1/1500)', value: 'Dung Beetle' },
                { name: 'Horse of Curses and Slurs (1/2000)', value: 'Horse of Curses and Slurs' }
            ))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
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
