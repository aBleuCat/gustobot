const {config} = require('../config');
const {queueMessage} = require('../helpers/messageQueue');

const SAY_IT_WITH_ME_REGEX = /^say it with me[:\s]+(.+)$/i;

async function handleSayItWithMe(message) {
	const match = SAY_IT_WITH_ME_REGEX.exec(message.content);
	if (!match) return;

	const phrase = match[1].trim();
	if (!phrase) return;

	// Check if user is admin or bot admin
	const isBotAdmin = config.lists?.botAdmins?.includes(
		message.author.id,
	);
	const isGuildAdmin =
		message.member?.permissions.has('Administrator');

	if (!isBotAdmin && !isGuildAdmin) {
		queueMessage({
			channel: message.channel,
			content: 'You need to be an admin to use this command.',
			reply: {message, mention: true},
		});
		return;
	}

	queueMessage({channel: message.channel, content: phrase});
}

module.exports = {handleSayItWithMe};
