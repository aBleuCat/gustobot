const {Events} = require('discord.js');
const {handleRandomCat} = require('../triggers/randomCat');
const {handleSixSeven} = require('../triggers/sixSeven');
const {handleLol} = require('../triggers/lol');
const {handleEveryone} = require('../triggers/everyone');
const {handleAutorole} = require('../triggers/autorole');
const {handleHorseSpawn} = require('../triggers/horseSpawner');
const {handleHaiku} = require('../triggers/haiku');
const {handleBotPing} = require('../helpers/pingHandler');
const {handleSayItWithMe} = require('../triggers/sayItWithMe');
const {devLog} = require('../helpers/devLog');
const {config} = require('../config');

function registerMessageHandler(client) {
	client.on(Events.MessageCreate, async (message) => {
		if (!message.guild || !message.author) return; // ignores dms
		const authorId = message.author.id;
		const isBot = message.author.bot;
		message.user ||= message.author;
		// Add to blacklists and whitelists with /hacks lists
		const canUsePrimary =
			(!isBot && !config.lists?.primaryTrigBlacklist?.includes(authorId)) ||
			config.lists?.primaryTrigWhitelist?.includes(authorId);
		const canUseSecondary =
			(!isBot && !config.lists?.secondaryTrigBlacklist?.includes(authorId)) ||
			config.lists?.secondaryTrigWhitelist?.includes(authorId);
		if (canUsePrimary) {
			try {
				await handleRandomCat(message);
				await handleSixSeven(message);
				await handleLol(message);
				await handleEveryone(message);
				await handleHaiku(message);
				await handleBotPing(message, client);
				await handleSayItWithMe(message);
			} catch (error) {
				console.error('Primary trigger error', error.message);
				devLog(`Primary trigger error: ${error.message}`);
			}
		}

		if (canUseSecondary) {
			try {
				await handleHorseSpawn(message);
			} catch (error) {
				console.error('Secondary trigger error', error.message);
				devLog(`Secondary trigger error: ${error.message}`);
			}
		}

		try {
			await handleAutorole(message); // Autorole works for everyone including bots
		} catch (error) {
			console.error('Autorole trigger error', error.message);
			devLog(`Autorole trigger error: ${error.message}`);
		}
	});
}

module.exports = {registerMessageHandler};
