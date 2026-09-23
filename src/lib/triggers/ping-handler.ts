import type { Client, Message } from "discord.js";
import { PingResponse } from "../models.js";
import queueMessage from "../helpers/message-queue.js";
import { returnAsTextBased } from "../../type-utils.js";

function pickWeighted<T extends { weight: number }>(
	pool: T[],
): T | undefined {
	const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
	if (totalWeight <= 0) return undefined;

	let roll = Math.random() * totalWeight;
	for (const item of pool) {
		roll -= item.weight;
		if (roll < 0) return item;
	}

	// Floating-point rounding can leave a tiny remainder; fall back to the last item.
	return pool.at(-1);
}

async function handleBotPing(message: Message, client: Client) {
	const channel = returnAsTextBased(message.channel);
	if (channel instanceof Error) return;
	if (!client.user) return;
	if (message.author.id === client.user.id) return;
	if (!message.mentions.has(client.user.id)) return;

	const content = message.content.toLowerCase();
	const allResponses = await PingResponse.find({}).lean();

	// `.lean()` skips Mongoose's schema-default application, so entries saved
	// before `weight` existed come back as `weight: undefined` — even though
	// the type says `number`. Left unhandled, that turns pickWeighted's sum
	// into NaN and silently breaks randomness for the whole pool. Normalize
	// once here so everything below can trust the value.
	for (const entry of allResponses) {
		if (typeof entry.weight !== "number" || Number.isNaN(entry.weight)) {
			entry.weight = 1;
		}
	}

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
	let finalSelectionPool: typeof allResponses = [];

	if (matches.length > 0) {
		// If specific triggers match, use those
		finalSelectionPool = matches;
	} else {
		// Fall back to untriggered messages if no triggers matched
		finalSelectionPool = allResponses.filter(
			(response) => !response.trigger.type,
		);
	}

	// Pick one at random, weighted by each entry's `weight`
	if (finalSelectionPool.length > 0) {
		const pick = pickWeighted(finalSelectionPool);
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
