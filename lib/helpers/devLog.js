const { config } = require('../config.js');

let logChannel = null;
let bgTasksChannel = null;
let microChannel = null;
let statusChannel = null;
const filterExceptions = ["error", "failed", "refreshing commands", "commands reloaded", "system initialized"].map(v => v.toLowerCase());

async function initDevLog(client) {
    try {
        const guild = await client.guilds.fetch(config.DEV_GUILD_ID);
        
        // Fetching all channels defined in config
        logChannel = await guild.channels.fetch(config.DEV_LOG_CHANNEL_ID).catch(() => null);
        bgTasksChannel = await guild.channels.fetch(config.BG_TASKS_CHANNEL_ID).catch(() => null);
        microChannel = await guild.channels.fetch(config.MICRO_LOG_CHANNEL_ID).catch(() => null);
        statusChannel = await guild.channels.fetch(config.STATUS_LOG_CHANNEL).catch(() => null);

        console.log(`[devLog] System Hooked: Main(#${logChannel?.name}), Status(#${statusChannel?.name})`);
    } catch (e) {
        console.error('[devLog Init Error]:', e.message);
    }
}

async function devLog(message, type = 'standard') {
    let targetChannel = null;
    let secondaryChannel = null;

    if (type === 'bg') {
        targetChannel = bgTasksChannel; // for background tasks
    } else if (type === 'micro') {
        targetChannel = microChannel; // for extra-detailed logs
    } else if (type === 'status') {
        targetChannel = statusChannel; // for status updates
    } else {
        targetChannel = logChannel; // for standard logs
        secondaryChannel = microChannel;
    }
    
    // Fallback to console
    if (!targetChannel) {
        console.log(`[DEV LOG ${type.toUpperCase()}]: ${message}`);
        return;
    }

    try {
        // Status updates probably don't need the `[DEV LOG]` prefix
        const prefix = type === 'status' ? '' : `\`[DEV LOG]\` `;
        const formattedMsg = `${prefix}${message}`;
        const lowMsg = formattedMsg.toLowerCase()

        // temporary to prevent rate limiting from too many requests to discord
        if (type !== 'status') {
            if (!filterExceptions.some(word => lowMsg.includes(word))) {
                if (type !== 'bg') { console.log(formattedMsg); }
                return;
            }
        }

        await targetChannel.send(formattedMsg);
        
        if (secondaryChannel) {
            await secondaryChannel.send(formattedMsg);
        }
    } catch (error) {
        console.error('[devLog Send Error]:', error.message);
    }
}

module.exports = { initDevLog, devLog };