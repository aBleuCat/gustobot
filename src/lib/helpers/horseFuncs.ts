import type { Channel } from 'discord.js';
import type { IUserHorses } from '../models.js';
import { HORSE_VALUES } from '../../horses.js';

export async function conditionHorse(user: IUserHorses, channel: Channel): Promise<void> {
  if (!('send' in channel)) return;

  let modified = false;

  const hasLight = (user.horses.get('brightness_prosperity') || 0) > 0;
  const hasDark = (user.horses.get('darkness_despair') || 0) > 0;
  const hasEqual = (user.horses.get('equality_parallelism') || 0) > 0;

  if (hasLight && hasDark && !hasEqual) {
    const lightName = HORSE_VALUES['brightness_prosperity']?.name ?? 'brightness_prosperity';
    const darkName = HORSE_VALUES['darkness_despair']?.name ?? 'darkness_despair';
    const equalName = HORSE_VALUES['equality_parallelism']?.name ?? 'equality_parallelism';

    user.horses.set('equality_parallelism', 1);
    user.markModified('horses');
    modified = true;

    await channel.send(`<@${user.userId}> woah the **${lightName}** and the **${darkName}** have spawned a **${equalName}**`).catch(() => {});
  }

  const hasJokery = (user.horses.get('jokery_confusion') || 0) > 0;

  if (!hasJokery) {
    let totalWealth = user.horseCoins || 0;

    for (const [horseKey, count] of user.horses.entries()) {
      const price = HORSE_VALUES[horseKey]?.value || 0;
      totalWealth += price * count;
    }

    if (totalWealth > 10000000) {
      const jokeryName = HORSE_VALUES['jokery_confusion']?.name ?? 'Horse of Jokery and Confusion';

      user.horses.set('jokery_confusion', 1);
      user.markModified('horses');
      modified = true;

      await channel.send(`<@${user.userId}> Your immense wealth of **$${totalWealth.toLocaleString()}** has manifested a **${jokeryName}**!`).catch(() => {});
    }
  }

  if (modified) {
    await user.save();
  }
}
