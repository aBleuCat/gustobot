import type {Message} from 'discord.js';
import {immutConfig} from '../config.js';
import queueMessage from '../helpers/message-queue.js';
import {returnAsTextBased} from '../../type-utils.js';

const SAY_IT_WITH_ME_REGEX = /^say it with me[:\s]+(.+)$/iv;

async function handleSayItWithMe(message: Message) {
	const channel = returnAsTextBased(message.channel);
	if (channel instanceof Error) return;
	const match = SAY_IT_WITH_ME_REGEX.exec(message.content);
	if (!match?.[1]) return;

	const phrase = match[1].trim();
	if (!phrase) return;

	// Check if user is admin or bot admin
	const isBotAdmin = immutConfig.ADMINS.has(message.author.id);

	if (
		!isBotAdmin /* && !isGuildAdmin <- do we really need this? */
	) {
		queueMessage({
			channel,
			content: 'You need to be an admin to use this command.',
			reply: {message, mention: true},
		}).catch((error: unknown) => {
			console.error(
				'QueueMessage Error in say-it-with-me command',
				error,
			);
		});
		return;
	}

	queueMessage({channel, content: phrase}).catch(
		(error: unknown) => {
			console.error(
				'QueueMessage Error in say-it-with-me command',
				error,
			);
		},
	);
}

export default handleSayItWithMe;
