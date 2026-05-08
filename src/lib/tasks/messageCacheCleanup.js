const {MessageCache} = require('../models');
const {config} = require('../config');
const {devLog} = require('../helpers/devLog');

let messageCacheCleanupInterval = null;

function startMessageCacheCleanup() {
	if (messageCacheCleanupInterval) return;

	messageCacheCleanupInterval = setInterval(async () => {
		try {
			const cleanupThreshold = Date.now() - config.MESSAGE_CACHE_CLEANUP_MS;

			const result = await MessageCache.deleteMany({
				lastMessageTime: {$lt: cleanupThreshold},
			});

			if (result.deletedCount > 0) {
				console.log(
					`[MessageCacheCleanup] Removed ${result.deletedCount} old message cache entries`,
				);
				await devLog(
					`[MessageCacheCleanup] Removed ${result.deletedCount} old message cache entries`,
					'bg',
				);
			}
		} catch (error) {
			console.error(
				'[MessageCacheCleanup] Error cleaning message cache:',
				error,
			);
			await devLog(
				`[MessageCacheCleanup] Error cleaning message cache: ${error.message}`,
				'bg',
			);
		}
	}, config.MESSAGE_CACHE_CLEANUP_MS);
}

function stopMessageCacheCleanup() {
	if (!messageCacheCleanupInterval) return;
	clearInterval(messageCacheCleanupInterval);
	messageCacheCleanupInterval = null;
}

module.exports = {startMessageCacheCleanup, stopMessageCacheCleanup};
