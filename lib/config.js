// Central mutable runtime config
// Changes are lost on restartg
const config = {
    // horseSpawner.js
    DEBOUNCE_MS: 2000,
    SIMILARITY_THRESHOLD: 0.70,
    RECENT_MSG_COUNT: 5,
    COIN_CHANCE: 250,
    SPAWN_COEFFICIENT: 15,
    FLAIR_THRESHOLD_VALUE: 100,
    COIN_DROP_SIZE: 3,

    // chatTriggers / randomCat
    UNEXPECTED_CAT_PROBABILITY: 1000,

    // horsegamble.js
    FRENZY_THRESHOLD_MS: 10 * 60 * 1000,
    FRENZY_CHANCE: 0.20,
    CONFISCATE_CHANCE: 0.25,
    LOSS_THRESHOLD: -75,
};

const descriptions = {
    DEBOUNCE_MS:               'Min ms between horse rolls per user',
    SIMILARITY_THRESHOLD:      'How similar two messages must be to be blocked (0-1)',
    RECENT_MSG_COUNT:          'How many recent messages to check for similarity',
    COIN_CHANCE:               '1 in X chance of dropping horse coins per message',
    SPAWN_COEFFICIENT:         'Horse spawn chance = 1 / (value * this)',
    FLAIR_THRESHOLD_VALUE:     'Horse value above which ✨ flair is added on spawn',
    COIN_DROP_SIZE:            'How many coins drop per spawn',
    UNEXPECTED_CAT_PROBABILITY: '1 in X chance of random cat gif per message',
    FRENZY_THRESHOLD_MS:       'Ms since last gamble within which gambling frenzy can trigger',
    FRENZY_CHANCE:             'Probability that gambling frenzy triggers (0-1)',
    CONFISCATE_CHANCE:         'Probability of police confiscating horse when no coins (0-1)',
    LOSS_THRESHOLD:            'Gambling roll below which horse is lost (negative number, preferably). Every gamble, a number between -100 and 100 is rolled',
};

module.exports = { config, descriptions };
