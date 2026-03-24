const { PingResponse } = require('../models');

async function handleBotPing(msg, client) {
    if (msg.author.id === client.user.id) return;
    if (!msg.mentions.has(client.user.id)) return;

    const content = msg.content.toLowerCase();
    const allResponses = await PingResponse.find({}).lean();

    // Check triggers first
    for (const entry of allResponses) {
        if (!entry.trigger?.type) continue;

        if (entry.trigger.type === 'contains' && content.includes(entry.trigger.text.toLowerCase())) {
            await msg.reply(entry.message).catch(() => {});
            return;
        }
        if (entry.trigger.type === 'exact' && content === entry.trigger.text.toLowerCase()) {
            await msg.reply(entry.message).catch(() => {});
            return;
        }
        if (entry.trigger.type === 'author' && msg.author.id === entry.trigger.text) {
            await msg.reply(entry.message).catch(() => {});
            return;
        }
    }

    // Fall back to random untriggered message
    const untriggered = allResponses.filter(e => !e.trigger?.type);
    if (!untriggered.length) return;
    const pick = untriggered[Math.floor(Math.random() * untriggered.length)];
    await msg.reply(pick.message).catch(() => {});
}

module.exports = { handleBotPing };
