const {HorseConfig, UserHorses, MessageCache} = require('../models');
const {stringSimilarity} = require('../helpers/similarity');
const {config} = require('../config');
const {conditionHorse} = require('../helpers/horseFuncs');
const HORSE_VALUES = require('../../horses.json');
const {devLog} = require('../helpers/devLog');
const {queueMessage} = require('../helpers/messageQueue');

async function handleHorseSpawn(message) {
	const hConfig = await HorseConfig.findOne({guildId: message.guild.id});
	if (!hConfig || !hConfig.enabled) {
		console.log(`[HORSE] Spawning disabled in ${message.guild.name}`);
		await devLog(
			`[HORSE] Spawning disabled in ${message.guild.name} (${message.guild.id})`,
		);
		return;
	}

	const now = Date.now();
	const messageText = message.content.trim().toLowerCase();

	// Debounce check
	let cache = await MessageCache.findOne({
		userId: message.author.id,
		guildId: message.guild.id,
	});
	cache ||= new MessageCache({
		userId: message.author.id,
		guildId: message.guild.id,
	});

	if (now - cache.lastMessageTime < config.DEBOUNCE_MS) {
		return;
	}

	// Similarity check
	const tooSimilar = cache.recentMessages.some(
		(previous) =>
			stringSimilarity(previous, messageText) >= config.SIMILARITY_THRESHOLD,
	);
	if (tooSimilar) {
		return;
	}

	await MessageCache.findOneAndUpdate(
		{userId: message.author.id, guildId: message.guild.id},
		{
			lastMessageTime: now,
			recentMessages: [messageText, ...(cache.recentMessages || [])].slice(
				0,
				config.RECENT_MSG_COUNT,
			),
		},
		{upsert: true},
	);

	const targetChan = await message.guild.channels
		.fetch(hConfig.channelId)
		.catch(() => message.channel);

	let inventory = await UserHorses.findOne({userId: message.author.id});
	inventory ||= new UserHorses({userId: message.author.id, horses: new Map()});

	let anySpawned = false;

	// Horse spawning
	for (const [slug, data] of Object.entries(HORSE_VALUES)) {
		if (data.spawn === false) continue;

		const displayName = data.name;
		const chance = Math.max(
			1,
			Math.floor(data.value * config.SPAWN_COEFFICIENT * config.ANTIINFLATOR),
		);

		if (Math.floor(Math.random() * chance) === 0) {
			inventory.horses.set(slug, (inventory.horses.get(slug) || 0) + 1);
			anySpawned = true;

			let prefix = 'found the';
			let decoration = '';
			if (data.value > config.FLAIR_THRESHOLD_VALUE || slug === 'dung_beetle') {
				prefix = slug === 'dung_beetle' ? 'gets ✨' : 'found the ✨';
				decoration = '✨';
			}

			console.log(`[HORSE] ${message.author.tag} spawned ${displayName}!`);
			await devLog(
				`[HORSE] ${message.author.tag} spawned ${displayName} in guild ${message.guild.name} (${message.guild.id})!`,
			);

			queueMessage({
				channel: targetChan,
				content: `<@${message.author.id}> ${prefix} **${displayName}**${decoration}!`,
			});
			if (data.link) queueMessage({channel: targetChan, content: data.link});

			await conditionHorse(inventory, targetChan);
		}
	}

	// Coin spawn
	if (anySpawned) {
		// Roll for coins as a bonus
		if (Math.floor(Math.random() * config.COIN_CHANCE) === 0) {
			const minDrop = Number.isInteger(config.COIN_DROP_MIN)
				? config.COIN_DROP_MIN
				: config.COIN_DROP_SIZE || 1;
			const maxDrop = Number.isInteger(config.COIN_DROP_MAX)
				? config.COIN_DROP_MAX
				: config.COIN_DROP_SIZE || 5;
			const dropSize =
				Math.floor(Math.random() * (maxDrop - minDrop + 1)) + minDrop;

			inventory.horseCoins = (inventory.horseCoins || 0) + dropSize;

			queueMessage({
				channel: targetChan,
				content: `<@${message.author.id}> acquired **${dropSize} Horse Coins** 🪙!`,
			});
		}

		await inventory.save();
	}
}

module.exports = {handleHorseSpawn};
