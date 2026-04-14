import type { Message } from 'discord.js';
import { HorseConfig, UserHorses, MessageCache } from '../models.js';
import { stringSimilarity } from '../helpers/similarity.js';
import { config } from '../config.js';
import { conditionHorse } from '../helpers/horseFuncs.js';
import { HORSE_VALUES } from '../../horses.js';
import { devLog } from '../helpers/devLog.js';

export async function handleHorseSpawn(msg: Message): Promise<void> {
  const hConfig = await HorseConfig.findOne({ guildId: msg.guild?.id });
  if (!hConfig || !hConfig.enabled) {
    console.log(`[HORSE] Spawning disabled in ${msg.guild?.name}`);
    await devLog(`[HORSE] Spawning disabled in ${msg.guild?.name} (${msg.guild?.id})`);
    return;
  }

  const now = Date.now();
  const msgText = msg.content.trim().toLowerCase();

  let cache = await MessageCache.findOne({ userId: msg.author.id, guildId: msg.guild!.id });
  if (!cache) cache = new MessageCache({ userId: msg.author.id, guildId: msg.guild!.id });

  if (now - cache.lastMessageTime < config.DEBOUNCE_MS) {
    return;
  }

  const tooSimilar = cache.recentMessages.some(prev => stringSimilarity(prev, msgText) >= config.SIMILARITY_THRESHOLD);
  if (tooSimilar) {
    return;
  }

  await MessageCache.findOneAndUpdate(
    { userId: msg.author.id, guildId: msg.guild!.id },
    {
      lastMessageTime: now,
      recentMessages: [msgText, ...(cache.recentMessages || [])].slice(0, config.RECENT_MSG_COUNT),
    },
    { upsert: true }
  );

  const targetChan =
    (await msg.guild!.channels.fetch(hConfig.channelId!).catch(() => null)) || msg.channel;

  let inventory = await UserHorses.findOne({ userId: msg.author.id });
  if (!inventory) inventory = new UserHorses({ userId: msg.author.id, horses: new Map() });

  let anySpawned = false;
  for (const [slug, data] of Object.entries(HORSE_VALUES)) {
    if ((data as any).spawn === false) continue;

    const displayName = data.name;
    const chance = Math.max(1, Math.floor(data.value * config.SPAWN_COEFFICIENT * config.ANTIINFLATOR));
    if (Math.floor(Math.random() * chance) === 0) {
      inventory.horses.set(slug, (inventory.horses.get(slug) || 0) + 1);
      anySpawned = true;

      let prefix = 'found the';
      let decoration = '';
      if (data.value > config.FLAIR_THRESHOLD_VALUE || slug === 'dung_beetle') {
        prefix = slug === 'dung_beetle' ? 'gets ✨' : 'found the ✨';
        decoration = '✨';
      }

      console.log(`[HORSE] ${msg.author.tag} spawned ${displayName}!`);
      await devLog(
        `[HORSE] ${msg.author.tag} spawned ${displayName} in guild ${msg.guild!.name} (${msg.guild!.id})!`
      );
      await (targetChan as any)
        .send(`<@${msg.author.id}> ${prefix} **${displayName}**${decoration}!`)
        .catch(() => {});
      if ((data as any).link) await (targetChan as any).send((data as any).link).catch(() => {});

      await conditionHorse(inventory, targetChan);
    }
  }

  if (anySpawned) {
    await inventory.save();
    if (Math.floor(Math.random() * config.COIN_CHANCE) === 0) {
      const minDrop = Number.isInteger(config.COIN_DROP_MIN) ? config.COIN_DROP_MIN : config.COIN_DROP_SIZE;
      const maxDrop = Number.isInteger(config.COIN_DROP_MAX) ? config.COIN_DROP_MAX : config.COIN_DROP_SIZE;
      const dropSize = Math.floor(Math.random() * (maxDrop - minDrop + 1)) + minDrop;

      inventory.horseCoins = (inventory.horseCoins || 0) + dropSize;
      await (targetChan as any).send(`<@${msg.author.id}> acquired **${dropSize} Horse Coins** 🪙!`);
      await inventory.save();
    }
  }
}
