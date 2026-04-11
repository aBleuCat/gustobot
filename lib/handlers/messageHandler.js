const { Events } = require('discord.js');
const { handleRandomCat } = require('../triggers/randomCat');
const { handleSixSeven } = require('../triggers/sixSeven');
const { handleLol } = require('../triggers/lol');
const { handleEveryone } = require('../triggers/everyone');
const { handleAutorole } = require('../triggers/autorole');
const { handleHorseSpawn } = require('../triggers/horseSpawner');
const { handleHaiku } = require('../triggers/haiku');
const { handleBotPing } = require('../helpers/pingHandler');
const { devLog } = require('../helpers/devLog');
const { config } = require('../config');

function registerMessageHandler(client) {
    client.on(Events.MessageCreate, async msg => {
        if (!msg.guild || !msg.author) return; // ignores dms
        const authorId = msg.author.id;
        const isBot = msg.author.bot;
        if (!msg.user) msg.user = msg.author;
        // add to blacklists and whitelists with /hacks lists
        const canUsePrimary = (!isBot && !config.lists?.primaryTrigBlacklist?.includes(authorId)) || config.lists?.primaryTrigWhitelist?.includes(authorId);
        const canUseSecondary = (!isBot && !config.lists?.secondaryTrigBlacklist?.includes(authorId)) || config.lists?.secondaryTrigWhitelist?.includes(authorId);
        if (canUsePrimary) {
            try {
                await handleRandomCat(msg);
                await handleSixSeven(msg);
                await handleLol(msg);
                await handleEveryone(msg);
                await handleHaiku(msg);
                await handleBotPing(msg, client);
            } catch (e) {
                console.error("Primary trigger error", e.message);
                devLog(`Primary trigger error: ${e.message}`);
            }
        }
        if (canUseSecondary) {
            try {
                await handleHorseSpawn(msg);
            } catch (e) {
                console.error("Secondary trigger error", e.message);
                devLog(`Secondary trigger error: ${e.message}`);
            }
        }
        try {
            await handleAutorole(msg); // autorole works for everyone including bots
        } catch (e) {
            console.error("Autorole trigger error", e.message);
            devLog(`Autorole trigger error: ${e.message}`);
        }
    });
}

module.exports = { registerMessageHandler };