const { HorseConfig, UserHorses, MessageCache } = require('../models');
const { stringSimilarity } = require('../helpers/similarity');
const HORSE_VALUES = require('../../horses.json');

const DEBOUNCE_MS = 2 * 1000;
const SIMILARITY_THRESHOLD = 0.70;
const RECENT_MSG_COUNT = 5;
const COIN_CHANCE = 200;

async function handleHorseSpawn(msg) {
    const hConfig = await HorseConfig.findOne({ guildId: msg.guild.id });
    if (!hConfig || !hConfig.enabled) return;

    const now = Date.now();
    const msgText = msg.content.trim().toLowerCase();

    // Debounce check
    let cache = await MessageCache.findOne({ userId: msg.author.id, guildId: msg.guild.id });
    if (!cache) cache = new MessageCache({ userId: msg.author.id, guildId: msg.guild.id });

    if (now - cache.lastMessageTime < DEBOUNCE_MS) {
        console.log(`[HORSE] Debounced ${msg.author.tag}`);
        return;
    }

    // Similarity check
    const tooSimilar = cache.recentMessages.some(prev => stringSimilarity(prev, msgText) >= SIMILARITY_THRESHOLD);
    if (tooSimilar) {
        console.log(`[HORSE] Too similar for ${msg.author.tag}`);
        return;
    }

    await MessageCache.findOneAndUpdate(
        { userId: msg.author.id, guildId: msg.guild.id },
        { lastMessageTime: now, recentMessages: [msgText, ...(cache.recentMessages || [])].slice(0, RECENT_MSG_COUNT) },
        { upsert: true }
    );

    const targetChan = await msg.guild.channels.fetch(hConfig.channelId).catch(() => msg.channel);
    const horseEntries = Object.entries(HORSE_VALUES);
    const maxVal = Math.max(...horseEntries.map(([_, data]) => data.value));
    const rollRange = maxVal * 10;
    const rand = Math.floor(Math.random() * rollRange);

    // 1 in 200 chance for 3 horse coins from chatting
    if (Math.floor(Math.random() * COIN_CHANCE) === 0) {
        let inventory = await UserHorses.findOne({ userId: msg.author.id });
        if (!inventory) inventory = new UserHorses({ userId: msg.author.id, horses: new Map() });
        inventory.horseCoins = (inventory.horseCoins || 0) + 3;
        await inventory.save();
        await targetChan.send(`<@${msg.author.id}> acquired **3 Horse Coins** 🪙!`);
    }

    console.log(`[HORSE] Roll for ${msg.author.tag}: ${rand}/${rollRange}`);

    let inventory = await UserHorses.findOne({ userId: msg.author.id });
    if (!inventory) inventory = new UserHorses({ userId: msg.author.id, horses: new Map() });

    const sortedHorses = horseEntries.sort((a, b) => b[1].value - a[1].value);
    for (const [name, data] of sortedHorses) {
        if (name === 'Horse Coin') continue;
        const rarity = data.value * 10;
        if (rand % rarity === 0) {
            inventory.horses.set(name, (inventory.horses.get(name) || 0) + 1);
            await inventory.save();

            let prefix = "found the";
            let decoration = "";
            if (name.includes("Providence") || name === "Dung Beetle") {
                prefix = name === "Dung Beetle" ? "gets ✨" : "found the ✨";
                decoration = "✨";
            }

            console.log(`[HORSE] ${msg.author.tag} spawned ${name}!`);
            await targetChan.send(`<@${msg.author.id}> ${prefix} **${name}**${decoration}!`);
            if (data.link) await targetChan.send(data.link);
            break;
        }
    }
}

module.exports = { handleHorseSpawn };
