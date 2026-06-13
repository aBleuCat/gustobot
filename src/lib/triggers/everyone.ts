import type {Message} from 'discord.js';
import {queueMessage} from '../helpers/message-queue.js';
import {returnAsTextBased} from '../../type-utils.js';

async function handleEveryone(message: Message) {
	if (!message.content.includes('@everyone')) return;
	const channel = returnAsTextBased(message.channel);
	if (channel instanceof Error) return;

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
