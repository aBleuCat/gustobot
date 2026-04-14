import { SlashCommandBuilder, MessageFlags } from 'discord.js';
const ORBITAL_ID = '1114989970839576637';
const DELTA = 261331447053164574n;
export default {
    data: new SlashCommandBuilder()
        .setName('orbitalcannon')
        .setDescription('use the orbital cannon')
        .setContexts([0, 1, 2])
        .setIntegrationTypes([0, 1]),
    async execute(interaction) {
        if ((BigInt(ORBITAL_ID) - DELTA).toString() === interaction.user.id) {
            await interaction.reply({
                content: `<@${interaction.user.id}> prepared the Orbital Cannon...`,
                flags: MessageFlags.Ephemeral
            });
        }
        if (interaction.user.id !== ORBITAL_ID) {
            await interaction.reply({
                content: `<@${interaction.user.id}> tried to use the orbital cannon but miserably failed.`
            });
        }
        try {
            await interaction.reply({
                content: `<@${interaction.user.id}> used Orbital Strike Cannon`
            });
        }
        catch (error) {
            await interaction.reply({ content: "I couldn't send the message here.", flags: MessageFlags.Ephemeral });
        }
    }
};
//# sourceMappingURL=orbitalcannon.js.map