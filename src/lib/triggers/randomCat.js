const { config } = require('../config');
const { queueMessage } = require('../helpers/messageQueue');

async function handleRandomCat(msg) {
    if (Math.floor(Math.random() * config.UNEXPECTED_CAT_PROBABILITY) === 0) {
        queueMessage({ channel: msg.channel, content: "https://tenor.com/view/post-this-cat-ryujinr-grey-cat-gif-13471549557469691566" });
    }
}

module.exports = { handleRandomCat };