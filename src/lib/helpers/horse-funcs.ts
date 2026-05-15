import type {GuildTextBasedChannel} from 'discord.js';
import type {IUserHorses} from '../models.js';
import rawHorseData from '../../data/horses.json' with {type: 'json'};
import {castAsHorseData} from '../../type-utils.js';

const HORSE_VALUES = castAsHorseData(rawHorseData);

async function checkForEqualitySpawn(
	user: IUserHorses,
	channel: GuildTextBasedChannel,
): Promise<boolean> {
	// Checks if user has brightness and darkness; if so, spawns equality
	const hasLight =
		(user.horses.get('brightness_prosperity') ?? 0) > 0;
	const hasDark = (user.horses.get('darkness_despair') ?? 0) > 0;
	const hasEqual = (user.horses.get('equality_parallelism') ?? 0) > 0;
	if (!(hasLight && hasDark && !hasEqual)) return false;
	const lightName =
		HORSE_VALUES.brightness_prosperity?.name ??
		'brightness_prosperity';
	const darkName =
		HORSE_VALUES.darkness_despair?.name ?? 'darkness_despair';
	const equalName =
		HORSE_VALUES.equality_parallelism?.name ?? 'equality_parallelism';

	user.horses.set('equality_parallelism', 1);
	user.markModified('horses');

	await channel
		.send(
			`<@${user.userId}> woah the **${lightName}** and the **${darkName}** have spawned a **${equalName}**`,
		)
		.catch();

	return true;
}

export async function conditionHorse(
	user: IUserHorses,
	channel: GuildTextBasedChannel,
) {
	const equalityModified = await checkForEqualitySpawn(user, channel);
	if (equalityModified) await user.save();
}
