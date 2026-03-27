const HORSE_VALUES = require('../../horses.json');

async function conditionHorse(user, channel) {
    // checks if user has brightness and darkness, if so spawns equality
    const hasLight = (user.horses.get('brightness_prosperity') || 0) > 0;
    const hasDark = (user.horses.get('darkness_despair') || 0) > 0;

    if (!hasLight || !hasDark) return;

    const lightName = HORSE_VALUES['brightness_prosperity']?.name ?? 'brightness_prosperity';
    const darkName = HORSE_VALUES['darkness_despair']?.name ?? 'darkness_despair';
    const equalName = HORSE_VALUES['equality_parallelism']?.name ?? 'equality_parallelism';

    user.horses.set('equality_parallelism', (user.horses.get('equality_parallelism') || 0) + 1);
    await user.save();

    await channel.send(
        `<@${user.userId}> woah the **${lightName}** and the **${darkName}** have spawned a **${equalName}**`
    ).catch(() => {});
}

module.exports = { conditionHorse };