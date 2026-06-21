import type { Message } from "discord.js";
import { MutedChannel } from "../models.js";
import updateLolStatsDB from "../helpers/lol-stats.js";
import queueMessage from "../helpers/message-queue.js";
import { returnAsTextBased } from "../../type-utils.js";

const TRIGGERS: Record<string, string> = {
	"\\blol\\b": "lol",
	"\\bis gustobot alive\\b": "yeah",
} as const;

// Map for milestone-based responses
const MILESTONES: Record<number, string> = {
	60: "<:PensiveKMS:1474277252546957400>\nPeople are starving in Africa because of ts",
	50: "https://cdn.discordapp.com/attachments/1477788764045705419/1495256837681840279/togif.gif",
	40: "Do you not have *anything* better to do?",
	20: "https://cdn.discordapp.com/attachments/1432537640074219640/1446352311319396484/togif.gif",
} as const;

async function handleLol(message: Message) {
	const channel = returnAsTextBased(message.channel);
	if (channel instanceof Error) return;
	const content = message.content.toLowerCase();

	// Find if any key in TRIGGERS matches the message content
	const match = Object.keys(TRIGGERS).find((pattern) =>
		new RegExp(pattern, "v").test(content),
	);

	if (!match) return;
	if (!TRIGGERS[match]) return;

	const isMuted = await MutedChannel.findOne({
		channelId: message.channel.id,
	});
	if (isMuted) return;

	// Send the response defined in the TRIGGERS object
	queueMessage({
		channel,
		content: TRIGGERS[match],
	}).catch((error: unknown) => {
		console.error("QueueMessage error:", error);
	});
	const stats = await updateLolStatsDB();

	// Check milestones (ordered descending to hit the highest modulo first)
	for (const count of Object.keys(MILESTONES).map((key) =>
		Number.parseInt(key, 10),
	)) {
		if (stats.daily % count === 0) {
			queueMessage({
				channel,
				content: MILESTONES[count] ?? "",
			}).catch((error: unknown) => {
				console.error("QueueMessage error:", error);
			});
			break; // Prevents multiple milestones triggering at once
		}
	}
}

export default handleLol;
