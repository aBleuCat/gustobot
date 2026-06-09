import type {Message} from 'discord.js';
import {MutedChannel} from '../models.js';
import {queueMessage} from '../helpers/message-queue.js';
import {castAsTextBased} from '../../type-utils.js';

const RESPONSES = [
	'grown man btw',
	'top 2% of students btw',
	'ok pack it up time to do your learning log',
	'stuybau',
	'ts not funny',
	'in the big 25 wait no thats not right year',
] as const;

async function handleSixSeven(message: Message) {
	if (!message.guild) return;
	const channel = castAsTextBased(message.channel);
	if (
		!/\b67\b|six seven|six-seven/iv.test(
			message.content.toLowerCase(),
		)
	)
		return;
	const isMuted = await MutedChannel.findOne({
		channelId: message.channel.id,
	});
	if (isMuted) return;
	const thingy =
		RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
	if (!thingy) return;
	queueMessage({
		channel,
		content: thingy,
		reply: {message, mention: true},
	}).catch((error: unknown) => {
		console.error(error);
	});
}

export default handleSixSeven;
