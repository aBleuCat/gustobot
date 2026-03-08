const { ModChannel } = require('../models');

async function logToModChannel(guild, message) {
    const config = await ModChannel.findOne({ guildId: guild.id });
    if (!config) return;
    const channel = await guild.channels.fetch(config.channelId).catch(() => null);
    if (channel) await channel.send(`[LOG]: ${message}`);
}

module.exports = { logToModChannel };
