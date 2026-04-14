import { Events } from 'discord.js';
import { handleRandomCat } from '../triggers/randomCat.js';
import { handleSixSeven } from '../triggers/sixSeven.js';
import { handleLol } from '../triggers/lol.js';
import { handleEveryone } from '../triggers/everyone.js';
import { handleAutorole } from '../triggers/autorole.js';
import { handleHorseSpawn } from '../triggers/horseSpawner.js';
import { handleHaiku } from '../triggers/haiku.js';
import { handleBotPing } from '../helpers/pingHandler.js';
import { devLog } from '../helpers/devLog.js';
import { config } from '../config.js';
export function registerMessageHandler(client) {
    client.on(Events.MessageCreate, async (msg) => {
        if (!msg.guild || !msg.author)
            return;
        const authorId = msg.author.id;
        const isBot = msg.author.bot;
        const canUsePrimary = (!isBot && !config.lists?.primaryTrigBlacklist?.includes(authorId)) ||
            config.lists?.primaryTrigWhitelist?.includes(authorId);
        const canUseSecondary = (!isBot && !config.lists?.secondaryTrigBlacklist?.includes(authorId)) ||
            config.lists?.secondaryTrigWhitelist?.includes(authorId);
        if (canUsePrimary) {
            try {
                await handleRandomCat(msg);
                await handleSixSeven(msg);
                await handleLol(msg);
                await handleEveryone(msg);
                await handleHaiku(msg);
                await handleBotPing(msg, client);
            }
            catch (e) {
                console.error('Primary trigger error', e.message);
                devLog(`Primary trigger error: ${e.message}`);
            }
        }
        if (canUseSecondary) {
            try {
                await handleHorseSpawn(msg);
            }
            catch (e) {
                console.error('Secondary trigger error', e.message);
                devLog(`Secondary trigger error: ${e.message}`);
            }
        }
        try {
            await handleAutorole(msg);
        }
        catch (e) {
            console.error('Autorole trigger error', e.message);
            devLog(`Autorole trigger error: ${e.message}`);
        }
    });
}
//# sourceMappingURL=messageHandler.js.map