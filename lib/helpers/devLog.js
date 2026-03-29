const { config } = require('../config.js');

let logChannel = null;
let bgTasksChannel = null;

async function initDevLog(client) {
    try {
        const guild = await client.guilds.fetch(config.DEV_GUILD_ID);
        const channel = await guild.channels.fetch(config.DEV_LOG_CHANNEL_ID);
        const bgChannel = await guild.channels.fetch(config.BG_TASKS_CHANNEL_ID);
    
        if (channel && channel.isTextBased()) {
            logChannel = channel;
            // log to console that special channel is ready
            console.log(`[devLog] Hooked into #${channel.name}`);
        }
        
        if (bgChannel && bgChannel.isTextBased()) {
            bgTasksChannel = bgChannel;
            // log to console that bg tasks channel is ready
            console.log(`[devLog] Hooked into #${bgChannel.name}`);
        }
    } catch (e) {
        console.error('[devLog Init Error]: Could not find dev channel.', e.message);
    }
}

async function devLog(message, type = 'special') {
    // Determine which channel to use based on type
    const channel = type === 'bg' ? bgTasksChannel : logChannel;
    
    // If channel isn't set up, just fallback to console
    if (!channel) {
        console.log(`[DEV LOG FAILED, FALLBACK]: ${message}`);
        return;
    }

    try {
        await channel.send(`\`[DEV LOG]\` ${message}`);
    } catch (error) {
        console.error('[devLog Send Error]:', error.message);
    }
}

module.exports = { initDevLog, devLog };