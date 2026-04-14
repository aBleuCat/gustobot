import { SlashCommandBuilder, MessageFlags, PermissionFlagsBits, EmbedBuilder, AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';
import { config, descriptions } from '../lib/config.js';

const OWNER_ID = '934290747623096381';

export default {
    data: new SlashCommandBuilder()
        .setName('hacks')
        .setDescription('Admin tools')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
        const focused = interaction.options.getFocused().toString().toLowerCase();
        const choices = Object.keys(config)
            .filter((k: any) => k.toLowerCase().includes(focused))
            .map((k: any) => ({ name: `${k} (currently: ${(config as any)[k]})`, value: k }))
            .slice(0, 25);
        await interaction.respond(choices);
    },

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        if (interaction.user.id !== OWNER_ID) {
            await interaction.reply({ content: 'you cannot do that bro', flags: MessageFlags.Ephemeral });
        }

        await interaction.reply({ content: 'AdminTools placeholder - Full implementation needed', flags: MessageFlags.Ephemeral });
    }
};
