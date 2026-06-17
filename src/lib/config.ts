// Central mutable runtime config
// Changes are lost on restart
import {castAsHorseData} from '../type-utils.js';
import rawHorseValues from '../data/horses.json' with {type: 'json'};

const HORSE_VALUES = castAsHorseData(rawHorseValues, 'all');

const BASELINE_SUM = 0.2; // I like rounded better
const currentInverseSum = Object.entries(HORSE_VALUES)
	.filter(([, data]) => data.spawn !== false)
	.reduce((sum, [, data]) => sum + 1 / data.value, 0);
const antiinflator = currentInverseSum / BASELINE_SUM;

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const immutConfig = {
	// Time constants. Instead of doing 2 * 60 * 1000 or even worse 120_000, do 2 * MINUTE_MS
	SECOND_MS,
	MINUTE_MS,
	HOUR_MS,
	DAY_MS,
	// Discord caps messages at 2000 characters; above that, the message is dumped into a text file, I think
	DISCORD_MSG_CHAR_LIMIT: 2000,
	DISCORD_MSG_SAFE_CHAR_LIMIT: 1900,
	// Bot admins (User Ids) that can use admin-only commands
	ADMINS: new Set(['934290747623096381', '853658523786412063']),
} as const;

export const config = {
	// For interaction-handler.ts
	CATCH_DATA_TTL_MS: 2 * MINUTE_MS,
	CATCH_DATA_CLEANUP_INTERVAL_MS: MINUTE_MS,

	// For horse-spawner.ts
	DEBOUNCE_MS: 2000,
	SIMILARITY_THRESHOLD: 0.7,
	RECENT_MSG_COUNT: 5,
	COIN_CHANCE: 4, // Spawns per horse instead of per message
	SPAWN_COEFFICIENT: 15,
	FLAIR_THRESHOLD_VALUE: 100,
	COIN_DROP_SIZE: 4,
	COIN_DROP_MIN: 3,
	COIN_DROP_MAX: 10,
	ANTIINFLATOR: antiinflator,

	// For random-cat.ts
	UNEXPECTED_CAT_PROBABILITY: 1000,

	// For horse-gamble.ts
	MIN_CYCLE_COIN_COUNT: -5,
	FRENZY_THRESHOLD_MS: 10 * MINUTE_MS,
	FRENZY_CHANCE: 0.2,
	CONFISCATE_CHANCE: 0.25,
	LOSS_THRESHOLD: -75,
	PROGRESSIVE_COIN_GAMBLE_TAX: 0.1,
	MAX_ROLL: 100,
	MIN_ROLL: -100,

	// For message-cache-cleanup.ts
	MESSAGE_CACHE_CLEANUP_MS: 10 * MINUTE_MS,

	// For dev-log.ts
	DEV_GUILD_ID: '1487571282022236313',
	DEV_LOG_CHANNEL_ID: '1487940219276759202',
	BG_TASKS_CHANNEL_ID: '1487958978985201755',
	MICRO_LOG_CHANNEL_ID: '1488302160012644522',
	STATUS_LOG_CHANNEL: '1489378845545988096',

	// For horse-buy.ts and horse-sell.ts
	COMMON_BUY_PRICE: 8,
	COMMON_SELL_PRICE: 2,

	// For autorole.ts
	RULE_CACHE_TTL_MS: MINUTE_MS,

	// For resource-monitor.ts
	HEAP_THRESHOLD_MB: 350,
	CPU_WARN_PERCENT: 80,
	RESOURCE_MONITOR_INTERVAL: 15_000,
	WARNING_COOLDOWN_MS: 5 * MINUTE_MS,

	// For message-queue.ts
	CHANNEL_MSG_LIMIT_MS: 1100,
	GLOBAL_MSG_LIMIT_MS: 50,

	// For role-reverter.ts
	ROLE_REVERTER_INTERVAL: 10_000,

	// For status-checker.ts
	STATUS_CHECKER_INTERVAL: 2 * MINUTE_MS,

	// Changeable with /hacks lists
	lists: {
		// Triggers for message-handler.ts
		primaryTrigBlacklist: [] as string[],
		primaryTrigWhitelist: [] as string[], // The bot crackgpt = 1428178018802733076
		secondaryTrigBlacklist: [] as string[],
		secondaryTrigWhitelist: [] as string[],
	},
};

export const descriptions: Record<keyof typeof config, string> = {
	CATCH_DATA_TTL_MS:
		'How long a user gets to catch a fake countryball before it expires (in ms)',
	CATCH_DATA_CLEANUP_INTERVAL_MS:
		'How frequently expired fake countryball spawn data is cleaned up',
	DEBOUNCE_MS: 'Min ms between horse rolls per user',
	SIMILARITY_THRESHOLD:
		'How similar two messages must be to be blocked (0-1)',
	RECENT_MSG_COUNT:
		'How many recent messages to check for similarity',
	COIN_CHANCE:
		'1 in X chance of dropping horse coins per horse spawned',
	SPAWN_COEFFICIENT:
		'Horse spawn chance = 1 / (value * this * ANTIINFLATOR)',
	FLAIR_THRESHOLD_VALUE:
		'Horse value above which ✨ flair is added on spawn',
	COIN_DROP_SIZE: 'Fallback coin drop size (for legacy behavior)',
	COIN_DROP_MIN: 'Minimum coins dropped when horse coins spawn',
	COIN_DROP_MAX: 'Maximum coins dropped when horse coins spawn',
	UNEXPECTED_CAT_PROBABILITY:
		'1 in X chance of random cat gif per message',
	FRENZY_THRESHOLD_MS:
		'Ms since last gamble within which gambling frenzy can trigger',
	FRENZY_CHANCE: 'Probability that gambling frenzy triggers (0-1)',
	CONFISCATE_CHANCE:
		'Probability of police confiscating horse when no coins (0-1)',
	LOSS_THRESHOLD:
		'Gambling roll below which horse is lost (negative number, preferably). Every gamble, a number between -100 and 100 is rolled',
	PROGRESSIVE_COIN_GAMBLE_TAX:
		'Cost per horse = floor(coins / 50 * this)',
	MAX_ROLL: 'Maximum possible roll for gambling (inclusive)',
	MIN_ROLL: 'Minimum possible roll for gambling (inclusive)',
	ANTIINFLATOR:
		'DO NOT TOUCH. Use SPAWN_COEFFICIENT to alter probablities. Multiplied with spawn chance to keep it balanced as horses are added',
	MIN_CYCLE_COIN_COUNT:
		'During a gambling cycle series, if you go below this threshold, the cycling halts',
	MESSAGE_CACHE_CLEANUP_MS:
		'How often to check and clear old message cache entries from the database (in ms)',
	DEV_GUILD_ID: 'Guild ID where devLog channel is located',
	DEV_LOG_CHANNEL_ID: 'Channel ID of devLog channel',
	BG_TASKS_CHANNEL_ID: 'Channel ID of background tasks log channel',
	MICRO_LOG_CHANNEL_ID:
		'Channel ID of micro log channel for extra-detailed logs',
	COMMON_BUY_PRICE: 'Price to buy a common horse in /horsebuy',
	STATUS_LOG_CHANNEL:
		'Channel ID of status log channel for bot status updates',
	COMMON_SELL_PRICE:
		'Price to sell a common horse in /horsesell. Sell price of any horse is value / 25 * this',
	RULE_CACHE_TTL_MS:
		'How long to cache autorole rules in memory to avoid DB hits every message (in ms)',
	lists: 'Lists that can be changed with /hacks lists',
	CHANNEL_MSG_LIMIT_MS:
		'Minimum ms between messages sent by the bot in the same channel',
	GLOBAL_MSG_LIMIT_MS:
		'Minimum ms between any messages sent by the bot',
	HEAP_THRESHOLD_MB: "The threshold for the bot's memory usage",
	CPU_WARN_PERCENT:
		'At what percentage of cpu usage should the bot send out a critical warning',
	WARNING_COOLDOWN_MS:
		'How frequently the bot sends out warnings when cpu/memory usage is critically high (in ms)',
	RESOURCE_MONITOR_INTERVAL:
		'How frequently the bot checks resource consumption (in ms)',
	ROLE_REVERTER_INTERVAL:
		'How frequently the bot checks to revert autoroles (in ms)',
	STATUS_CHECKER_INTERVAL:
		'How frequently the bot checks the status of the database connection (in ms)',
};
