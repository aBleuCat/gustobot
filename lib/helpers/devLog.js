const { config } = require('../config.js');

let logChannel = null;

async function initDevLog(client) {
    try {
        const guild = await client.guilds.fetch(config.DEV_GUILD_ID);
        const channel = await guild.channels.fetch(config.DEV_LOG_CHANNEL_ID);
    
        if (channel && channel.isTextBased()) {
            logChannel = channel;
            // Olog to console that it's ready
            console.log(`[devLog] Hooked into #${channel.name}`);
        }
    } catch (e) {
        console.error('[devLog Init Error]: Could not find dev channel.', e.message);
    }
}

async function devLog(message) {
    // If channel isn't set up, just fallback to console
    if (!logChannel) {
        console.log(`[DEV LOG FAILED, FALLBACK]: ${message}`);
        return;
    }

    try {
        await logChannel.send(`\`[DEV LOG]\` ${message}`);
    } catch (error) {
        console.error('[devLog Send Error]:', error.message);
    }
}

module.exports = { initDevLog, devLog };