import { config } from '../config.js';
let logChannel = null;
let bgTasksChannel = null;
let microChannel = null;
let statusChannel = null;
export async function initDevLog(client) {
    try {
        const guild = await client.guilds.fetch(config.DEV_GUILD_ID);
        logChannel = (await guild.channels.fetch(config.DEV_LOG_CHANNEL_ID).catch(() => null));
        bgTasksChannel = (await guild.channels.fetch(config.BG_TASKS_CHANNEL_ID).catch(() => null));
        microChannel = (await guild.channels.fetch(config.MICRO_LOG_CHANNEL_ID).catch(() => null));
        statusChannel = (await guild.channels.fetch(config.STATUS_LOG_CHANNEL).catch(() => null));
        console.log(`[devLog] System Hooked: Main(#${logChannel?.name}), Status(#${statusChannel?.name})`);
    }
    catch (e) {
        console.error('[devLog Init Error]:', e.message);
    }
}
export async function devLog(message, type = 'standard') {
    let targetChannel = null;
    let secondaryChannel = null;
    if (type === 'bg') {
        targetChannel = bgTasksChannel;
    }
    else if (type === 'micro') {
        targetChannel = microChannel;
    }
    else if (type === 'status') {
        targetChannel = statusChannel;
    }
    else {
        targetChannel = logChannel;
        secondaryChannel = microChannel;
    }
    // Fallback to console
    if (!targetChannel) {
        console.log(`[DEV LOG ${type.toUpperCase()}]: ${message}`);
        return;
    }
    try {
        const prefix = type === 'status' ? '' : `\`[DEV LOG]\` `;
        const formattedMsg = `${prefix}${message}`;
        await targetChannel.send(formattedMsg);
        if (secondaryChannel) {
            await secondaryChannel.send(formattedMsg);
        }
    }
    catch (error) {
        console.error('[devLog Send Error]:', error.message);
    }
}
//# sourceMappingURL=devLog.js.map