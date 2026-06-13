import type {Message} from 'discord.js';
import {config} from '../config.js';
import {queueMessage} from '../helpers/message-queue.js';
import {returnAsTextBased} from '../../type-utils.js';

async function handleRandomCat(message: Message) {
	const channel = returnAsTextBased(message.channel);
	if (channel instanceof Error) return;
	if (
		Math.floor(
			Math.random() * config.UNEXPECTED_CAT_PROBABILITY,
		) === 0
	) {
		queueMessage({
			channel,
			content:
				'https://tenor.com/view/post-this-cat-ryujinr-grey-cat-gif-13471549557469691566',
		}).catch((error: unknown) => {
			console.error(error);
		});
	}
}

export default handleRandomCat;
