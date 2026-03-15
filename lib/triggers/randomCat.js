const { config } = require('../config');

async function handleRandomCat(msg) {
    if (Math.floor(Math.random() * config.UNEXPECTED_CAT_PROBABILITY) === 0) {
        await msg.channel.send("https://tenor.com/view/post-this-cat-ryujinr-grey-cat-gif-13471549557469691566").catch(() => {});
    }
}

module.exports = { handleRandomCat };