import { MessageCache } from '../models.js';
import { config } from '../config.js';
import { devLog } from '../helpers/devLog.js';

let messageCacheCleanupInterval: NodeJS.Timer | null = null;

export function startMessageCacheCleanup(): void {
  if (messageCacheCleanupInterval) return;

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
    } catch (error) {
      console.error('[MessageCacheCleanup] Error cleaning message cache:', error);
      await devLog(`[MessageCacheCleanup] Error cleaning message cache: ${(error as Error).message}`, 'bg');
    }
  }, config.MESSAGE_CACHE_CLEANUP_MS);
}

export function stopMessageCacheCleanup(): void {
  if (!messageCacheCleanupInterval) return;
  clearInterval(messageCacheCleanupInterval as any);
  messageCacheCleanupInterval = null;
}
