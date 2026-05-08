const {config} = require('../config.js');

let logChannel = null;
let bgTasksChannel = null;
let microChannel = null;
let statusChannel = null;
const filterExceptions = [
	'error',
	'failed',
	'refreshing commands',
	'commands reloaded',
	'system initialized',
	'warning',
].map((v) => v.toLowerCase());

async function initDevLog(client) {
	try {
		const guild = await client.guilds.fetch(config.DEV_GUILD_ID);

		// Fetching all channels defined in config
		logChannel = await guild.channels
			.fetch(config.DEV_LOG_CHANNEL_ID)
			.catch(() => null);
		bgTasksChannel = await guild.channels
			.fetch(config.BG_TASKS_CHANNEL_ID)
			.catch(() => null);
		microChannel = await guild.channels
			.fetch(config.MICRO_LOG_CHANNEL_ID)
			.catch(() => null);
		statusChannel = await guild.channels
			.fetch(config.STATUS_LOG_CHANNEL)
			.catch(() => null);

		console.log(
			`[devLog] System Hooked: Main(#${logChannel?.name}), Status(#${statusChannel?.name})`,
		);
	} catch (error) {
		console.error('[devLog Init Error]:', error.message);
	}
}

async function devLog(message, type = 'standard') {
	let targetChannel = null;
	let secondaryChannel = null;

	switch (type) {
		case 'bg': {
			targetChannel = bgTasksChannel; // For background tasks

			break;
		}

		case 'micro': {
			targetChannel = microChannel; // For extra-detailed logs

			break;
		}

		case 'status': {
			targetChannel = statusChannel; // For status updates

			break;
		}

		default: {
			targetChannel = logChannel; // For standard logs
			secondaryChannel = microChannel;
		}
	}

	// Fallback to console
	if (!targetChannel) {
		console.log(`[DEV LOG ${type.toUpperCase()}]: ${message}`);
		return;
	}

	try {
		// Status updates probably don't need the `[DEV LOG]` prefix
		const prefix = type === 'status' ? '' : `\`[DEV LOG]\` `;
		const formattedMessage = `${prefix}${message}`;
		const lowMessage = formattedMessage.toLowerCase();

		// Temporary to prevent rate limiting from too many requests to discord
		if (
			type !== 'status' &&
			!filterExceptions.some((word) => lowMessage.includes(word))
		) {
			if (type !== 'bg') {
				console.log(formattedMessage);
			}

			return;
		}

		await targetChannel.send(formattedMessage);

		if (secondaryChannel) {
			await secondaryChannel.send(formattedMessage);
		}
	} catch (error) {
		console.error('[devLog Send Error]:', error.message);
	}
}

module.exports = {initDevLog, devLog};
