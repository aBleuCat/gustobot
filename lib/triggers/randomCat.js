const unexpected_cat_probability = 1000;

async function handleRandomCat(msg) {
    if (Math.floor(Math.random() * unexpected_cat_probability) + 1 === 64) {
        await msg.channel.send("https://tenor.com/view/post-this-cat-ryujinr-grey-cat-gif-13471549557469691566").catch(() => {});
    }
}

module.exports = { handleRandomCat };
