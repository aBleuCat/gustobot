// Only visible to user 853658523786412063 hmmm

import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
	type User,
} from 'discord.js';

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = path.dirname(__filename);

const ADMIN_ID = '853658523786412063';
const TOGGLE_FILE = path.join(__dirname, '../.dmlogtoggle');

export const dmLogToggleCommand = {
	data: new SlashCommandBuilder()
		.setName('dmlogtoggle')
		.setDescription('Toggle DM debug logs (admin only)'),
	async execute(interaction: ChatInputCommandInteraction) {
		if (interaction.user.id !== ADMIN_ID) {
			return interaction.reply({
				content: 'You do not have permission to use this command.',
				ephemeral: true,
			});
		}

		let enabled = false;
		enabled = fs.existsSync(TOGGLE_FILE)
			? !fs.readFileSync(TOGGLE_FILE, 'utf8').includes('on')
			: true;
		fs.writeFileSync(TOGGLE_FILE, enabled ? 'on' : 'off');
		await interaction.reply({
			content: `DM debug logs are now **${enabled ? 'ENABLED' : 'DISABLED'}**.`,
			ephemeral: true,
		});
	},
	isVisibleTo(user: User) {
		return user.id === ADMIN_ID;
	},
};
