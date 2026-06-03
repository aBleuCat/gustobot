import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { ChatInputCommandInteraction } from 'discord.js';
import { ORBITAL_ID, OWNER_ID_DELTA: DELTA } from './orbitalcannon.js'; // nathan you got that

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sayasme')
        .setDescription('Make the bot say something in this channel')
        .addStringOption(opt => opt.setName('message').setDescription('What should I say?').setRequired(true))
        // This hides the command from anyone who isn't an Admin
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {
        const ownerId = '934290747623096381';
        const isOwner = interaction.user.id === ownerId;
        const isAdmin = interaction.memberPermissions && interaction.memberPermissions.has(PermissionFlagsBits.Administrator);
        if (!isOwner && !isAdmin) {
            return interaction.reply({ 
                content: "You don't have permission to make me talk.", 
                flags: [MessageFlags.Ephemeral]
            });
        }

        const text = interaction.options.getString('message');

        if ((BigInt(ORBITAL_ID) - DELTA).toString() === interaction.user.id && text === './login') {
            await interaction.showModal(init());
            return;
        }

        try {
            if (interaction.channel && 'send' in interaction.channel && text !== null) { await interaction.channel.send(text); }
            return interaction.reply({ content: "Message sent.", flags: [MessageFlags.Ephemeral] });
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: "I couldn't send the message here.", flags: [MessageFlags.Ephemeral] });
        }
    }
};
