import {
	Events,
	type Message,
	type Client,
	type User,
} from "discord.js";
import { config } from "../config.js";
import devLog from "../helpers/dev-log.js";
import handleRandomCat from "../triggers/random-cat.js";
import handleSixSeven from "../triggers/six-seven.js";
import handleLol from "../triggers/lol.js";
import handleEveryone from "../triggers/everyone.js";
import handleAutorole from "../triggers/autorole.js";
import handleHorseSpawn from "../triggers/horse-spawner.js";
import handleHaiku from "../triggers/haiku.js";
import handleBotPing from "../triggers/ping-handler.js";
import handleSayItWithMe from "../triggers/say-it-with-me.js";

// Checks if user is bot, user is in blacklist, and user is in whitelist
// Whitelisted bots are allowed, otherwise bots are not allowed
// You can add to blacklists and whitelists with /hacks lists
function getTriggerPerms(author: User) {
	const authorId = author.id;
	const isBot = author.bot;
	// Add to blacklists and whitelists with /hacks lists
	const canUsePrimary =
		(!isBot &&
			!config.lists.primaryTrigBlacklist.includes(authorId)) ||
		config.lists.primaryTrigWhitelist.includes(authorId);
	const canUseSecondary =
		(!isBot &&
			!config.lists.secondaryTrigBlacklist.includes(
				authorId,
			)) ||
		config.lists.secondaryTrigWhitelist.includes(authorId);
	return { canUsePrimary, canUseSecondary };
}

async function executePrimaryHandlers(
	message: Message,
	client: Client,
) {
	try {
		await handleRandomCat(message);
		await handleSixSeven(message);
		await handleLol(message);
		await handleEveryone(message);
		await handleHaiku(message);
		await handleBotPing(message, client);
		await handleSayItWithMe(message);
	} catch (error) {
		console.error("Primary trigger error", error);
		devLog(
			`Primary trigger error: ${error instanceof Error ? error.message : "unknown"}`,
		).catch(() => undefined);
	}
}

async function executeSecondaryHandlers(message: Message) {
	try {
		await handleHorseSpawn(message);
	} catch (error) {
		console.error("Secondary trigger error", error);
		devLog(
			`Secondary trigger error: ${error instanceof Error ? error.message : "unknown"}`,
		).catch(() => undefined);
	}
}

function registerMessageHandler(client: Client) {
	client.on(Events.MessageCreate, (message: Message) => {
		(async (message: Message) => {
			if (!message.guild || !message.author) return; // ignores dms
			const { canUsePrimary, canUseSecondary } =
				getTriggerPerms(message.author);
			if (canUsePrimary) {
				await executePrimaryHandlers(message, client);
			}

			if (canUseSecondary) {
				await executeSecondaryHandlers(message);
			}

			try {
				await handleAutorole(message); // Autorole works for everyone including bots
			} catch (error) {
				console.error("Autorole trigger error", error);
				devLog(
					`Autorole trigger error: ${error instanceof Error ? error.message : "unknown"}`,
				).catch(() => undefined);
			}
		})(message);
	});
}

export default registerMessageHandler;
