import type { Message } from 'discord.js';
import { MutedChannel } from '../models.js';
import { updateLolStatsDB } from '../helpers/lolStats.js';

export async function handleLol(msg: Message): Promise<void> {
  if (!/\blol\b/.test(msg.content.toLowerCase())) return;
  const isMuted = await MutedChannel.findOne({ channelId: msg.channel.id });
  if (isMuted) return;

  if (!('send' in msg.channel)) return;

  await msg.channel.send('lol').catch(() => {});
  const stats = await updateLolStatsDB();

  if (stats.daily % 60 === 0) {
    await msg.channel
      .send('<:PensiveKMS:1474277252546957400>\nPeople are starving in Africa because of ts')
      .catch(() => {});
  } else if (stats.daily % 40 === 0) {
    await msg.channel.send('Do you not have *anything* better to do?').catch(() => {});
  } else if (stats.daily % 20 === 0) {
    await msg
      .channel.send('https://cdn.discordapp.com/attachments/1432537640074219640/1446352311319396484/togif.gif')
      .catch(() => {});
  }
}
