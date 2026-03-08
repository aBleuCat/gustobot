const { Events } = require('discord.js');
const { handleRandomCat } = require('../triggers/randomCat');
const { handleSixSeven } = require('../triggers/sixSeven');
const { handleLol } = require('../triggers/lol');
const { handleEveryone } = require('../triggers/everyone');
const { handleAutorole } = require('../triggers/autorole');
const { handleHorseSpawn } = require('../triggers/horseSpawner');
const { handleBotPing } = require('../helpers/pingHandler');

function registerMessageHandler(client) {
    client.on(Events.MessageCreate, async msg => {
        if (!msg.guild) return;
        if (msg.author.bot && msg.author.id !== '1428178018802733076') return;

        try {
            await handleRandomCat(msg);
            await handleSixSeven(msg);
            await handleLol(msg);
            await handleEveryone(msg);
        } catch (e) { console.error("Trigger Error:", e.message); }

        await handleAutorole(msg);
        await handleHorseSpawn(msg).catch(e => console.error("Horse Spawn Error:", e.message));
        await handleBotPing(msg, client).catch(e => console.error("PingHandler Error:", e.message));
    });
}

module.exports = { registerMessageHandler };
