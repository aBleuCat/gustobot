// Central mutable runtime config
// Changes are lost on restart
// words
const HORSE_VALUES = require('../horses.json');

let BASELINE_SUM = 0.2; // i like rounded better
let currentInverseSum = Object.entries(HORSE_VALUES)
    .reduce((sum, [, data]) => sum + 1 / data.value, 0);
let antiinflator = currentInverseSum / BASELINE_SUM;

const config = {
    // horseSpawner.js
    DEBOUNCE_MS: 2000,
    SIMILARITY_THRESHOLD: 0.70,
    RECENT_MSG_COUNT: 5,
    COIN_CHANCE: 4, // spawns per horse instead of per message
    SPAWN_COEFFICIENT: 15,
    FLAIR_THRESHOLD_VALUE: 100,
    COIN_DROP_SIZE: 4,
    COIN_DROP_MIN: 3,
    COIN_DROP_MAX: 8,
    ANTIINFLATOR: antiinflator,

    // chatTriggers / randomCat
    UNEXPECTED_CAT_PROBABILITY: 1000,
    MIN_CYCLE_COIN_COUNT: -5,

    // horsegamble.js
    FRENZY_THRESHOLD_MS: 10 * 60 * 1000,
    FRENZY_CHANCE: 0.20,
    CONFISCATE_CHANCE: 0.25,
    LOSS_THRESHOLD: -75,

    // messageCacheCleanup.js
    MESSAGE_CACHE_CLEANUP_MS: 10 * 60 * 1000,
};

const descriptions = {
    DEBOUNCE_MS:               'Min ms between horse rolls per user',
    SIMILARITY_THRESHOLD:      'How similar two messages must be to be blocked (0-1)',
    RECENT_MSG_COUNT:          'How many recent messages to check for similarity',
    COIN_CHANCE:               '1 in X chance of dropping horse coins per horse spawned',
    SPAWN_COEFFICIENT:         'Horse spawn chance = 1 / (value * this * ANTIINFLATOR)',
    FLAIR_THRESHOLD_VALUE:     'Horse value above which ✨ flair is added on spawn',
    COIN_DROP_SIZE:            'Fallback coin drop size (for legacy behavior)',
    COIN_DROP_MIN:             'Minimum coins dropped when horse coins spawn',
    COIN_DROP_MAX:             'Maximum coins dropped when horse coins spawn',
    UNEXPECTED_CAT_PROBABILITY: '1 in X chance of random cat gif per message',
    FRENZY_THRESHOLD_MS:       'Ms since last gamble within which gambling frenzy can trigger',
    FRENZY_CHANCE:             'Probability that gambling frenzy triggers (0-1)',
    CONFISCATE_CHANCE:         'Probability of police confiscating horse when no coins (0-1)',
    LOSS_THRESHOLD:            'Gambling roll below which horse is lost (negative number, preferably). Every gamble, a number between -100 and 100 is rolled',
    ANTIINFLATOR:              'DO NOT TOUCH. Use SPAWN_COEFFICIENT to alter probablities. Multiplied with spawn chance to keep it balanced as horses are added',
    MIN_CYCLE_COIN_COUNT:      'During a gambling cycle series, if you go below this threshold, the cycling halts',
    MESSAGE_CACHE_CLEANUP_MS:  'How often to check and clear old message cache entries from the database (in ms)',
};

module.exports = { config, descriptions };
