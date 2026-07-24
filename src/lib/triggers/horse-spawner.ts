import type {
	Guild,
	GuildTextBasedChannel,
	Message,
} from "discord.js";
import {
	HorseConfig,
	UserHorses,
	MessageCache,
	type IUserHorses,
} from "../models.js";
import stringSimilarity from "../helpers/similarity-helper.js";
import { config } from "../config.js";
import { conditionHorse } from "../helpers/horse-funcs.js";
import rawHorseValues from "../../data/horses.json" with { type: "json" };
import {
	castAsHorseData,
	returnAsTextBased,
} from "../../type-utils.js";
import devLog from "../helpers/dev-log.js";
import queueMessage from "../helpers/message-queue.js";
import type { HorseData } from "../../types.js";

const HORSE_VALUES = castAsHorseData(rawHorseValues);

// Pure function: Rolls all horses with given spawn parameters.
function rollHorseSpawns(
	spawnCoefficient: number,
	antiinflator: number,
): {
	spawnedCounts: Record<string, number>;
	spawnedHorses: HorseData;
	anySpawned: boolean;
} {
	const spawnedHorses: HorseData = {};
	const spawnedCounts: Record<string, number> = {};
	let isAnySpawned = false;

	for (const [slug, data] of Object.entries(HORSE_VALUES)) {
		if (data.spawn === false) continue;

		const chance = Math.max(
			1,
			Math.floor(data.value * spawnCoefficient * antiinflator),
		);

		if (Math.floor(Math.random() * chance) === 0) {
			spawnedCounts[slug] = (spawnedCounts[slug] ?? 0) + 1;
			isAnySpawned = true;
			spawnedHorses[slug] = data;
		}
	}

	return { spawnedCounts, spawnedHorses, anySpawned: isAnySpawned };
}

// Guaranteed single-horse spawn by slug.
function forceSingleHorse(slug: string): {
	spawnedCounts: Record<string, number>;
	spawnedHorses: HorseData;
	anySpawned: true;
} {
	const data = HORSE_VALUES[slug];
	if (!data) throw new Error(`Unknown horse: ${slug}`);
	return {
		spawnedCounts: { [slug]: 1 },
		spawnedHorses: { [slug]: data },
		anySpawned: true,
	};
}

// MongoDB $inc upsert + coin roll.
async function applySpawnInventory(
	userId: string,
	spawnedCounts: Record<string, number>,
): Promise<{
	inventory: IUserHorses;
	coinDropSize: number | undefined;
	// eslint-disable-next-line @typescript-eslint/no-restricted-types
} | null> {
	if (Object.keys(spawnedCounts).length === 0) return null;

	const inc: Record<string, number> = {};
	for (const [slug, count] of Object.entries(spawnedCounts)) {
		inc[`horses.${slug}`] = count;
	}

	let coinDropSize: number | undefined;
	if (Math.floor(Math.random() * config.COIN_CHANCE) === 0) {
		const minDrop: number =
			config.COIN_DROP_MIN ?? config.COIN_DROP_SIZE;
		const maxDrop: number =
			config.COIN_DROP_MAX ?? config.COIN_DROP_SIZE;
		const dropSize =
			Math.floor(Math.random() * (maxDrop - minDrop + 1)) +
			minDrop;
		inc.horseCoins = dropSize;
		coinDropSize = dropSize;
	}

	const inventory = await UserHorses.findOneAndUpdate(
		{ userId },
		{
			$inc: inc,
			$setOnInsert: { userId },
		},
		{ upsert: true, new: true },
	);

	if (!inventory) return null;
	return { inventory, coinDropSize };
}

// Sends all spawn messages + coin notification via queue.
function sendSpawnMessages(
	userId: string,
	channel: GuildTextBasedChannel,
	spawnedHorses: HorseData,
	coinDropSize?: number,
): void {
	for (const [slug, data] of Object.entries(spawnedHorses)) {
		let prefix = "found the";
		let decoration = "";
		if (
			data.value > config.FLAIR_THRESHOLD_VALUE ||
			slug === "dung_beetle"
		) {
			prefix =
				slug === "dung_beetle" ? "gets ✨" : "found the ✨";
			decoration = "✨";
		}

		queueMessage({
			channel,
			content: `<@${userId}> ${prefix} **${data.name}**${decoration}!`,
			priority: 2,
		}).catch((error: unknown) => {
			console.error(
				"QueueMessage error while spawning horse:",
				error,
			);
		});
		if (data.link) {
			queueMessage({
				channel,
				content: data.link,
				priority: 2,
			}).catch((error: unknown) => {
				console.error(
					"QueueMessage error while spawning horse:",
					error,
				);
			});
		}
	}

	if (typeof coinDropSize === "number") {
		queueMessage({
			channel,
			content: `<@${userId}> acquired **${coinDropSize} Horse Coins** 🪙!`,
		}).catch((error: unknown) => {
			console.error(
				"QueueMessage error while spawning horse:",
				error,
			);
		});
	}
}

async function cacheAndCheckMessage(
	message: Message,
): Promise<boolean> {
	if (!message.guild) return false;
	const now = Date.now();
	const messageText = message.content.trim().toLowerCase();
	let cache = await MessageCache.findOne({
		userId: message.author.id,
		guildId: message.guild.id,
	});
	cache ??= new MessageCache({
		userId: message.author.id,
		guildId: message.guild.id,
	});
	// Debounce check
	if (now - cache.lastMessageTime < config.DEBOUNCE_MS) {
		return false;
	}

	// Similarity check
	const isTooSimilar = cache.recentMessages.some(
		(previous) =>
			stringSimilarity(previous, messageText) >=
			config.SIMILARITY_THRESHOLD,
	);
	if (isTooSimilar) {
		return false;
	}

	await MessageCache.findOneAndUpdate(
		{ userId: message.author.id, guildId: message.guild.id },
		{
			lastMessageTime: now,
			recentMessages: [
				messageText,
				...(cache.recentMessages ?? []),
			].slice(0, config.RECENT_MSG_COUNT),
		},
		{ upsert: true },
	);

	return true;
}

// Force spawn: Bypasses opt-in, debounce, and enabled checks.
async function forceSpawnHorse(
	userId: string,
	guild: Guild,
	options?: { horseSlug?: string },
): Promise<{
	spawnedHorses: HorseData;
	// eslint-disable-next-line @typescript-eslint/no-restricted-types
	inventory: IUserHorses | null;
	coinDropSize: number | undefined;
}> {
	const hConfig = await HorseConfig.findOne({ guildId: guild.id });
	const targetChannel = hConfig?.channelId
		? await guild.channels
				.fetch(hConfig.channelId)
				.catch(() => null)
		: null;

	const channel = returnAsTextBased(targetChannel);
	if (channel instanceof Error) {
		throw new Error(`No valid channel for guild ${guild.id}`);
	}

	const { spawnedCounts, spawnedHorses, anySpawned } =
		options?.horseSlug
			? forceSingleHorse(options.horseSlug)
			: rollHorseSpawns(
					config.SPAWN_COEFFICIENT,
					config.ANTIINFLATOR,
				);

	const result = anySpawned
		? await applySpawnInventory(userId, spawnedCounts)
		: null;

	sendSpawnMessages(
		userId,
		channel,
		spawnedHorses,
		result?.coinDropSize,
	);

	if (result?.inventory) {
		await conditionHorse(result.inventory, { channel });
	}

	return {
		spawnedHorses,
		inventory: result?.inventory ?? null,
		coinDropSize: result?.coinDropSize,
	};
}

// Main handler: Opt-in, debounce, enabled checks.
async function handleHorseSpawn(message: Message) {
	if (!message.guild) return;
	const hConfig = await HorseConfig.findOne({
		guildId: message.guild.id,
	});
	if (!hConfig?.enabled) {
		console.log(
			`[HORSE] Spawning disabled in ${message.guild.name}`,
		);
		await devLog(
			`[HORSE] Spawning disabled in ${message.guild.name} (${message.guild.id})`,
		);
		return;
	}

	const { optIn } = (await UserHorses.findOne(
		{ userId: message.author.id },
		{ optIn: 1 },
	).lean()) ?? { optIn: false };

	if (!optIn) {
		console.log(
			`Horse did not spawn because ${message.author.displayName} was opted out`,
		);
		return;
	}

	if (!(await cacheAndCheckMessage(message))) return;

	const targetChannel = await message.guild.channels
		.fetch(hConfig.channelId)
		.catch(() => message.channel);

	const { spawnedCounts, spawnedHorses, anySpawned } =
		rollHorseSpawns(
			config.SPAWN_COEFFICIENT,
			config.ANTIINFLATOR,
		);

	for (const data of Object.values(spawnedHorses)) {
		console.log(
			`[HORSE] ${message.author.tag} spawned ${data.name} in guild ${message.guild.name} (${message.guild.id})!`,
		);
	}

	const castedChannel = returnAsTextBased(targetChannel);
	if (castedChannel instanceof Error) return;

	const result = anySpawned
		? await applySpawnInventory(message.author.id, spawnedCounts)
		: null;

	sendSpawnMessages(
		message.author.id,
		castedChannel,
		spawnedHorses,
		result?.coinDropSize,
	);

	if (result?.inventory) {
		await conditionHorse(result.inventory, {
			channel: castedChannel,
		});
	}
}

export { forceSpawnHorse };
export default handleHorseSpawn;
