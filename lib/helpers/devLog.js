const { config } = require('../config.js');

// Global references to the channels
let logChannel = null;
let bgTasksChannel = null;
let microChannel = null;

async function initDevLog(client) {
    try {
        const guild = await client.guilds.fetch(config.DEV_GUILD_ID);
        const main = await guild.channels.fetch(config.DEV_LOG_CHANNEL_ID);
        const bg = await guild.channels.fetch(config.BG_TASKS_CHANNEL_ID);
        const micro = await guild.channels.fetch(config.MICRO_LOG_CHANNEL_ID);

        if (main?.isTextBased()) {
            logChannel = main;
            console.log(`[devLog] Hooked into #${main.name}`);
        }
        
        if (bg?.isTextBased()) {
            bgTasksChannel = bg;
            console.log(`[devLog] Hooked into #${bg.name}`);
        }

        if (micro?.isTextBased()) {
            microChannel = micro;
            console.log(`[devLog] Hooked into #${micro.name}`);
        }
    } catch (e) {
        console.error('[devLog Init Error]: Could not find dev channel.', e.message);
    }
}

async function devLog(message, type = 'standard') {
    let targetChannel = null;
    let secondaryChannel = null;

    if (type === 'bg') {
        targetChannel = bgTasksChannel;
    } else if (type === 'micro') {
        targetChannel = microChannel;
    } else {
        // 'standard' uses logChannel and cross-posts to microChannel
        targetChannel = logChannel;
        secondaryChannel = microChannel;
    }
    
    // fallback to console
    if (!targetChannel) {
        console.log(`[DEV LOG FALLBACK]: ${message}`);
        return;
    }

    try {
        const formattedMsg = `\`[DEV LOG]\` ${message}`;
        
        // Send to primary target
        await targetChannel.send(formattedMsg);
        
        // Send to secondary if exists (for 'standard' logs)
        if (secondaryChannel) {
            await secondaryChannel.send(formattedMsg);
        }
    } catch (error) {
        console.error('[devLog Send Error]:', error.message);
    }
}

module.exports = { initDevLog, devLog };