// Commands/dmlogtoggle.js
// Only visible to user 853658523786412063

const path = require('node:path');
const fs = require('node:fs');
const {SlashCommandBuilder} = require('discord.js');

const ADMIN_ID = '853658523786412063';
const TOGGLE_FILE = path.join(__dirname, '../.dmlogtoggle');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('dmlogtoggle')
		.setDescription('Toggle DM debug logs (admin only)'),
	async execute(interaction) {
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
	isVisibleTo(user) {
		return user.id === ADMIN_ID;
	},
};
