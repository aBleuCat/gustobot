import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADMIN_ID = '853658523786412063';
const TOGGLE_FILE = path.join(__dirname, '../.dmlogtoggle');

export default {
    data: new SlashCommandBuilder()
        .setName('dmlogtoggle')
        .setDescription('Toggle DM debug logs (admin only)'),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        if (interaction.user.id !== ADMIN_ID) {
            await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }
        let enabled = false;
        if (fs.existsSync(TOGGLE_FILE)) {
            enabled = !fs.readFileSync(TOGGLE_FILE, 'utf8').includes('on');
        } else {
            enabled = true;
        }
        fs.writeFileSync(TOGGLE_FILE, enabled ? 'on' : 'off');
        await interaction.reply({ content: `DM debug logs are now **${enabled ? 'ENABLED' : 'DISABLED'}**.`, ephemeral: true });
    },
};
