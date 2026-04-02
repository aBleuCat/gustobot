const HORSE_VALUES = require('../../horses.json');

async function conditionHorse(user, channel) {
    let modified = false;

    // Checks if user has brightness and darkness; if so, spawns equality
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

        await channel.send(
            `<@${user.userId}> woah the **${lightName}** and the **${darkName}** have spawned a **${equalName}**`
        ).catch(() => {});
    }

    // Only give jokery if they don't already have one
    const hasJokery = (user.horses.get('jokery_confusion') || 0) > 0;

    if (!hasJokery) {
        let totalWealth = user.horseCoins || 0;

        for (const [horseKey, count] of user.horses.entries()) {
            const price = HORSE_VALUES[horseKey]?.value || 0;
            totalWealth += (price * count);
        }

        if (totalWealth > 10000000) {
            const jokeryName = HORSE_VALUES['jokery_confusion']?.name ?? 'Horse of Jokery and Confusion';

            user.horses.set('jokery_confusion', 1);
            user.markModified('horses');
            modified = true;

            await channel.send(
                `<@${user.userId}> Your immense wealth of **$${totalWealth.toLocaleString()}** has manifested a **${jokeryName}**!`
            ).catch(() => {});
        }
    }

    // Only save if something actually changed
    if (modified) {
        await user.save();
    }
}

module.exports = { conditionHorse };
