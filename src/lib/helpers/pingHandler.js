const { PingResponse } = require('../models');
const { queueMessage } = require('./messageQueue');

async function handleBotPing(msg, client) {
    if (msg.author.id === client.user.id) return;
    if (!msg.mentions.has(client.user.id)) return;

    const content = msg.content.toLowerCase();
    const allResponses = await PingResponse.find({}).lean();

    // filter for all matching triggered responses
    const matches = allResponses.filter(entry => {
        if (!entry.trigger?.type) return false;

        const triggerText = entry.trigger.text.toLowerCase();

        if (entry.trigger.type === 'contains' && content.includes(triggerText)) return true;
        if (entry.trigger.type === 'exact' && content === triggerText) return true;
        if (entry.trigger.type === 'author' && msg.author.id === entry.trigger.text) return true;

        return false;
    });

    // select the final response list
    let finalSelectionPool = [];

    if (matches.length > 0) {
        // if specific triggers match, use those
        finalSelectionPool = matches;
    } else {
        // fall back to untriggered messages if no triggers matched
        finalSelectionPool = allResponses.filter(e => !e.trigger?.type);
    }

    // pick one at random
    if (finalSelectionPool.length > 0) {
        const pick = finalSelectionPool[Math.floor(Math.random() * finalSelectionPool.length)];
        queueMessage({ channel: msg.channel, content: pick.message, reply: { message: msg, mention: true } });
    }
}

module.exports = { handleBotPing };