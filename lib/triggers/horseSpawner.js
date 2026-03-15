const { HorseConfig, UserHorses, MessageCache } = require('../models');
const { stringSimilarity } = require('../helpers/similarity');
const { config } = require('../config');
const HORSE_VALUES = require('../../horses.json');

async function handleHorseSpawn(msg) {
    const hConfig = await HorseConfig.findOne({ guildId: msg.guild.id });
    if (!hConfig || !hConfig.enabled) return;

    const now = Date.now();
    const msgText = msg.content.trim().toLowerCase();

    // Debounce check
    let cache = await MessageCache.findOne({ userId: msg.author.id, guildId: msg.guild.id });
    if (!cache) cache = new MessageCache({ userId: msg.author.id, guildId: msg.guild.id });

    if (now - cache.lastMessageTime < config.DEBOUNCE_MS) {
        console.log(`[HORSE] Debounced ${msg.author.tag}`);
        return;
    }

    // Similarity check
    const tooSimilar = cache.recentMessages.some(prev => stringSimilarity(prev, msgText) >= config.SIMILARITY_THRESHOLD);
    if (tooSimilar) {
        console.log(`[HORSE] Too similar for ${msg.author.tag}`);
        return;
    }

    await MessageCache.findOneAndUpdate(
        { userId: msg.author.id, guildId: msg.guild.id },
        { lastMessageTime: now, recentMessages: [msgText, ...(cache.recentMessages || [])].slice(0, config.RECENT_MSG_COUNT) },
        { upsert: true }
    );

    const targetChan = await msg.guild.channels.fetch(hConfig.channelId).catch(() => msg.channel);

    // Coin drop
    if (Math.floor(Math.random() * config.COIN_CHANCE) === 0) {
        let inventory = await UserHorses.findOne({ userId: msg.author.id });
        if (!inventory) inventory = new UserHorses({ userId: msg.author.id, horses: new Map() });
        inventory.horseCoins = (inventory.horseCoins || 0) + config.COIN_DROP_SIZE;
        await inventory.save();
        await targetChan.send(`<@${msg.author.id}> acquired **${config.COIN_DROP_SIZE} Horse Coins** 🪙!`);
    }

    // Roll independently for each horse
    let inventory = await UserHorses.findOne({ userId: msg.author.id });
    if (!inventory) inventory = new UserHorses({ userId: msg.author.id, horses: new Map() });

    let anySpawned = false;
    for (const [name, data] of Object.entries(HORSE_VALUES)) {
        if (name === 'Horse Coin') continue;
        const chance = data.value * config.SPAWN_COEFFICIENT;
        if (Math.floor(Math.random() * chance) === 0) {
            inventory.horses.set(name, (inventory.horses.get(name) || 0) + 1);
            anySpawned = true;

            let prefix = "found the";
            let decoration = "";
            if (data.value > config.FLAIR_THRESHOLD_VALUE || name === "Dung Beetle") {
                prefix = name === "Dung Beetle" ? "gets ✨" : "found the ✨";
                decoration = "✨";
            }

            console.log(`[HORSE] ${msg.author.tag} spawned ${name}!`);
            await targetChan.send(`<@${msg.author.id}> ${prefix} **${name}**${decoration}!`);
            if (data.link) await targetChan.send(data.link);
        }
    }

    if (anySpawned) await inventory.save();
}

module.exports = { handleHorseSpawn };