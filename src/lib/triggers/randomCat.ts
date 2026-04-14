import type { Message } from 'discord.js';
import { config } from '../config.js';

export async function handleRandomCat(msg: Message): Promise<void> {
  if (Math.floor(Math.random() * config.UNEXPECTED_CAT_PROBABILITY) === 0) {
    if (!('send' in msg.channel)) return;
    await msg
      .channel.send('https://tenor.com/view/post-this-cat-ryujinr-grey-cat-gif-13471549557469691566')
      .catch(() => {});
  }
}
