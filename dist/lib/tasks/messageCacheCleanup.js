import { MessageCache } from '../models.js';
import { config } from '../config.js';
import { devLog } from '../helpers/devLog.js';
let messageCacheCleanupInterval = null;
export function startMessageCacheCleanup() {
    if (messageCacheCleanupInterval)
        return;
    messageCacheCleanupInterval = setInterval(async () => {
        try {
            const cleanupThreshold = Date.now() - config.MESSAGE_CACHE_CLEANUP_MS;
            const result = await MessageCache.deleteMany({
                lastMessageTime: { $lt: cleanupThreshold },
            });
            if (result.deletedCount > 0) {
                console.log(`[MessageCacheCleanup] Removed ${result.deletedCount} old message cache entries`);
                await devLog(`[MessageCacheCleanup] Removed ${result.deletedCount} old message cache entries`, 'bg');
            }
        }
        catch (error) {
            console.error('[MessageCacheCleanup] Error cleaning message cache:', error);
            await devLog(`[MessageCacheCleanup] Error cleaning message cache: ${error.message}`, 'bg');
        }
    }, config.MESSAGE_CACHE_CLEANUP_MS);
}
export function stopMessageCacheCleanup() {
    if (!messageCacheCleanupInterval)
        return;
    clearInterval(messageCacheCleanupInterval);
    messageCacheCleanupInterval = null;
}
//# sourceMappingURL=messageCacheCleanup.js.map