import type {Message} from 'discord.js';
import {queueMessage} from '../helpers/message-queue.js';
import {castAsTextBased} from '../../type-utils.js';

async function handleEveryone(message: Message) {
	if (!message.content.includes('@everyone')) return;
	let channel;
	try {
		channel = castAsTextBased(message.channel);
	} catch (error) {
		console.error(error);
		return;
	}

	queueMessage({
		channel,
		content:
			'https://cdn.discordapp.com/attachments/1432537640074219640/1446352311319396484/togif.gif',
		priority: 1,
	}).catch((error: unknown) => {
		console.error(error);
	});
}

export default handleEveryone;
