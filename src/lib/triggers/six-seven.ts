import type { Message } from "discord.js";
import { MutedChannel } from "../models.js";
import queueMessage from "../helpers/message-queue.js";
import { returnAsTextBased } from "../../type-utils.js";
import { randItem } from "../helpers/random-helpers.js";

const RESPONSES = [
	"grown man btw",
	"top 2% of students btw",
	"ok pack it up time to do your learning log",
	"stuybau",
	"ts not funny",
	"in the big 25 wait no thats not right year",
] as const;

async function handleSixSeven(message: Message) {
	const channel = returnAsTextBased(message.channel);
	if (channel instanceof Error) return;
	if (
		!/\b67\b|six seven|six-seven/iv.test(
			message.content.toLowerCase(),
		)
	)
		{return;}

	const isMuted = await MutedChannel.findOne({
		channelId: message.channel.id,
	});
	if (isMuted) return;
	const thingy = randItem(RESPONSES);
	if (!thingy) return;
	queueMessage({
		channel,
		content: thingy,
		reply: { message, mention: true },
	}).catch((error: unknown) => {
		console.error(error);
	});
}

export default handleSixSeven;
