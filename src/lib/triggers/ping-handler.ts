import type { Client, Message } from "discord.js";
import { PingResponse } from "../models.js";
import queueMessage from "../helpers/message-queue.js";
import { returnAsTextBased } from "../../type-utils.js";

async function handleBotPing(message: Message, client: Client) {
	const channel = returnAsTextBased(message.channel);
	if (channel instanceof Error) return;
	if (!client.user) return;
	if (message.author.id === client.user.id) return;
	if (!message.mentions.has(client.user.id)) return;

	const content = message.content.toLowerCase();
	const allResponses = await PingResponse.find({}).lean();

	// Filter for all matching triggered responses
	const matches = allResponses.filter((entry) => {
		if (!entry.trigger.type) return false;

		const triggerText = entry.trigger.text?.toLowerCase();
		if (!triggerText) return false;

		if (
			entry.trigger.type === "contains" &&
			content.includes(triggerText)
		)
			{return true;}

		if (entry.trigger.type === "exact" && content === triggerText)
			{return true;}

		if (
			entry.trigger.type === "author" &&
			message.author.id === entry.trigger.text
		)
			{return true;}

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
			(response) => !response.trigger.type,
		);
	}

	// Pick one at random
	if (finalSelectionPool.length > 0) {
		const pick =
			finalSelectionPool[
				Math.floor(Math.random() * finalSelectionPool.length)
			];
		if (!pick) return;
		queueMessage({
			channel,
			content: pick.message,
			reply: { message, mention: true },
		}).catch((error: unknown) => {
			console.error(
				"QueueMessage Error in ping handler",
				error,
			);
		});
	}
}

export default handleBotPing;
