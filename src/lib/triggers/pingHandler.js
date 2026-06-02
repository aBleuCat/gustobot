const {PingResponse} = require('../models');
const {queueMessage} = require('./messageQueue');

async function handleBotPing(message, client) {
	if (message.author.id === client.user.id) return;
	if (!message.mentions.has(client.user.id)) return;

	const content = message.content.toLowerCase();
	const allResponses = await PingResponse.find({}).lean();

	// Filter for all matching triggered responses
	const matches = allResponses.filter((entry) => {
		if (!entry.trigger?.type) return false;

		const triggerText = entry.trigger.text.toLowerCase();

		if (
			entry.trigger.type === 'contains' &&
			content.includes(triggerText)
		)
			return true;
		if (entry.trigger.type === 'exact' && content === triggerText)
			return true;
		if (
			entry.trigger.type === 'author' &&
			message.author.id === entry.trigger.text
		)
			return true;

		return false;
	});

	// Select the final response list
	let finalSelectionPool = [];

	if (matches.length > 0) {
		// If specific triggers match, use those
		finalSelectionPool = matches;
	} else {
		// Fall back to untriggered messages if no triggers matched
		finalSelectionPool = allResponses.filter(
			(e) => !e.trigger?.type,
		);
	}

	// Pick one at random
	if (finalSelectionPool.length > 0) {
		const pick =
			finalSelectionPool[
				Math.floor(Math.random() * finalSelectionPool.length)
			];
		queueMessage({
			channel: message.channel,
			content: pick.message,
			reply: {message, mention: true},
		});
	}
}

module.exports = {handleBotPing};
