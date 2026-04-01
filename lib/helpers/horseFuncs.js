const HORSE_VALUES = require('../../horses.json');

async function conditionHorse(user, channel) {
    // checks if user has brightness and darkness, if so spawns equality
    const hasLight = (user.horses.get('brightness_prosperity') || 0) > 0;
    const hasDark = (user.horses.get('darkness_despair') || 0) > 0;
    const hasEqual = (user.horses.get('equality_parallelism') || 0) > 0;

    if (hasLight && hasDark && !hasEqual) {
        const lightName = HORSE_VALUES['brightness_prosperity']?.name ?? 'brightness_prosperity';
        const darkName = HORSE_VALUES['darkness_despair']?.name ?? 'darkness_despair';
        const equalName = HORSE_VALUES['equality_parallelism']?.name ?? 'equality_parallelism';

        user.horses.set('equality_parallelism', 1);
        
        await channel.send(
            `<@${user.userId}> woah the **${lightName}** and the **${darkName}** have spawned a **${equalName}**`
        ).catch(() => {});
    }

    const hasJokery = (user.horses.get('jokery_confusion') || 0) > 0;

    if (!hasJokery) {
        let totalWealth = user.horseCoins || 0;

        // Calculate value of all horses in the Map
        for (const [horseKey, count] of user.horses.entries()) {
            const price = HORSE_VALUES[horseKey]?.value || 0;
            totalWealth += (price * count);
        }

        // Check if wealth exceeds $10,000,000
        if (totalWealth > 10000000) {
            const jokeryName = HORSE_VALUES['jokery_confusion']?.name ?? 'Horse of Jokery and Confusion';
            
            user.horses.set('jokery_confusion', (user.horses.get('jokery_confusion') || 0) + 1);
            
            await channel.send(
                `<@${user.userId}> Your immense wealth of **$${totalWealth.toLocaleString()}** has manifested a **${jokeryName}**!`
            ).catch(() => {});
        }
    }

    // Save changes if any modifications were made
    if (user.isModified()) {
        await user.save();
    }
}

module.exports = { conditionHorse };