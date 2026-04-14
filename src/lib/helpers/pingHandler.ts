import type { Message, Client } from 'discord.js';
import { PingResponse } from '../models.js';

export async function handleBotPing(msg: Message, client: Client): Promise<void> {
  if (msg.author.id === client.user?.id) return;
  if (!msg.mentions.has(client.user!.id)) return;

  const content = msg.content.toLowerCase();
  const allResponses = await PingResponse.find({}).lean();

  for (const entry of allResponses) {
    if (!entry.trigger?.type) continue;

    if (entry.trigger.type === 'contains' && content.includes(entry.trigger.text?.toLowerCase() || '')) {
      await msg.reply(entry.message).catch(() => {});
      return;
    }
    if (entry.trigger.type === 'exact' && content === entry.trigger.text?.toLowerCase()) {
      await msg.reply(entry.message).catch(() => {});
      return;
    }
    if (entry.trigger.type === 'author' && msg.author.id === entry.trigger.text) {
      await msg.reply(entry.message).catch(() => {});
      return;
    }
  }

  const untriggered = allResponses.filter(e => !e.trigger?.type);
  if (!untriggered.length) return;
  const pick = untriggered[Math.floor(Math.random() * untriggered.length)];
  await msg.reply(pick.message).catch(() => {});
}
