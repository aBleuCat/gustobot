import type { Message } from 'discord.js';

export async function handleEveryone(msg: Message): Promise<void> {
  if (!msg.content.includes('@everyone')) return;
  if (!('send' in msg.channel)) return;
  await msg
    .channel.send('https://cdn.discordapp.com/attachments/1432537640074219640/1446352311319396484/togif.gif')
    .catch(() => {});
}
