import type {Message} from 'discord.js';
import {HorseConfig, UserHorses, MessageCache} from '../models.js';
import stringSimilarity from '../helpers/similarity-helper.js';
import {config} from '../config.js';
import {conditionHorse} from '../helpers/horse-funcs.js';
import rawHorseValues from '../../data/horses.json' with {type: 'json'};
import {castAsHorseData, castAsTextBased} from '../../type-utils.js';
import {devLog} from '../helpers/dev-log.js';
import {queueMessage} from '../helpers/message-queue.js';
import type {HorseData} from '../../types.js';

const HORSE_VALUES = castAsHorseData(rawHorseValues);

function determineSpawnedHorses(message: Message) {
	const spawnedHorses: HorseData = {};
	const spawnedCounts: Record<string, number> = {};
	let anySpawned = false;

	for (const [slug, data] of Object.entries(HORSE_VALUES)) {
		if (data.spawn === false) continue;

		const displayName = data.name;
		const chance = Math.max(
			1,
			Math.floor(
				data.value *
					config.SPAWN_COEFFICIENT *
					config.ANTIINFLATOR,
			),
		);

		if (Math.floor(Math.random() * chance) === 0) {
			spawnedCounts[slug] = (spawnedCounts[slug] ?? 0) + 1;
			anySpawned = true;

			console.log(
				`[HORSE] ${message.author.tag} spawned ${displayName} in guild ${message.guild?.name} (${message.guild?.id})!`,
			);
			spawnedHorses[slug] = data;
		}
	}

	return {spawnedCounts, spawnedHorses, anySpawned};
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
	const tooSimilar = cache.recentMessages.some(
		(previous) =>
			stringSimilarity(previous, messageText) >=
			config.SIMILARITY_THRESHOLD,
	);
	if (tooSimilar) {
		return false;
	}

	await MessageCache.findOneAndUpdate(
		{userId: message.author.id, guildId: message.guild.id},
		{
			lastMessageTime: now,
			recentMessages: [
				messageText,
				...(cache.recentMessages ?? []),
			].slice(0, config.RECENT_MSG_COUNT),
		},
		{upsert: true},
	);

	return true;
}

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

	if (!(await cacheAndCheckMessage(message))) return;

	const targetChannel = await message.guild.channels
		.fetch(hConfig.channelId)
		.catch(() => message.channel);

	// Determine what spawns (does not modify DB)
	const {spawnedCounts, spawnedHorses, anySpawned} =
		determineSpawnedHorses(message);

	const castedChannel = (() => {
		try {
			return castAsTextBased(targetChannel);
		} catch {
			return undefined;
		}
	})();
	if (!castedChannel) return;

	// Apply atomic updates to inventory if any spawned
	let inventory;
	let coinDropSize: number | undefined;
	if (anySpawned) {
		const inc: Record<string, number> = {};
		for (const [slug, count] of Object.entries(spawnedCounts)) {
			inc[`horses.${slug}`] = count;
		}

		// Roll for coins as a bonus
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

		inventory = await UserHorses.findOneAndUpdate(
			{userId: message.author.id},
			{
				$inc: inc,
				$setOnInsert: {userId: message.author.id, horses: {}},
			},
			{upsert: true, new: true},
		);
	}

	for (const [slug, data] of Object.entries(spawnedHorses)) {
		let prefix = 'found the';
		let decoration = '';
		if (
			data.value > config.FLAIR_THRESHOLD_VALUE ||
			slug === 'dung_beetle'
		) {
			prefix =
				slug === 'dung_beetle' ? 'gets ✨' : 'found the ✨';
			decoration = '✨';
		}

		queueMessage({
			channel: castedChannel,
			content: `<@${message.author.id}> ${prefix} **${data.name}**${decoration}!`,
			priority: 2,
		}).catch((error: unknown) => {
			console.error(
				`QueueMessage error while spawning horse: ${error instanceof Error ? error : 'unknown error'}`,
			);
		});
		if (data.link)
			queueMessage({
				channel: castedChannel,
				content: data.link,
				priority: 2,
			}).catch((error: unknown) => {
				console.error(
					`QueueMessage error while spawning horse: ${error instanceof Error ? error : 'unknown error'}`,
				);
			});
	}

	// If we updated inventory atomically, notify about coin drops and run condition
	if (anySpawned && inventory) {
		if (typeof coinDropSize === 'number') {
			queueMessage({
				channel: castedChannel,
				content: `<@${message.author.id}> acquired **${coinDropSize} Horse Coins** 🪙!`,
			}).catch((error: unknown) => {
				console.error(
					`QueueMessage error while spawning horse: ${error instanceof Error ? error : 'unknown error'}`,
				);
			});
		}

		await conditionHorse(inventory, {channel: castedChannel});
	}
}

export default handleHorseSpawn;
