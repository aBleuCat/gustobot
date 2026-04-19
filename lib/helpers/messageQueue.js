// Message queue for multi-layer rate-limited sending
const messageQueue = [];
let isProcessing = false;
const { config } = require('../config');

// constants
const CHANNEL_LIMIT_MS = config.CHANNEL_MSG_LIMIT_MS;
const GLOBAL_LIMIT_MS = config.GLOBAL_MSG_LIMIT_MS;

// Tracking state
let lastGlobalSend = 0;
const lastChannelSend = new Map(); // Store channelId -> timestamp

// Add a message to the queue
function queueMessage({ channel, content, reply = null }) {
    messageQueue.push({ channel, content, reply });
    processQueue();
}

// Helper to determine if a message is ready to be sent based on both limits
function isReady(msg) {
    const now = Date.now();
    const globalElapsed = now - lastGlobalSend;
    const channelElapsed = now - (lastChannelSend.get(msg.channel.id) || 0);

    return globalElapsed >= GLOBAL_LIMIT_MS && channelElapsed >= CHANNEL_LIMIT_MS;
}

async function processQueue() {
    if (isProcessing || messageQueue.length === 0) return;
    isProcessing = true;

    while (messageQueue.length > 0) {
        // Find the first message in the queue that satisfies both rate limits
        const index = messageQueue.findIndex(msg => isReady(msg));

        if (index === -1) {
            // wait before recheck
            await new Promise(resolve => setTimeout(resolve, 50));
            continue;
        }

        // Remove the ready item from the queue
        const item = messageQueue.splice(index, 1)[0];
        
        try {
            if (item.reply) {
                await item.channel.send({
                    content: item.content,
                    reply: item.reply.mention ? { messageReference: item.reply.message } : undefined
                });
            } else {
                await item.channel.send(item.content);
            }
            
            // Update tracking timestamps
            const now = Date.now();
            lastGlobalSend = now;
            lastChannelSend.set(item.channel.id, now);

        } catch (e) {
            console.error("Queue send error:", e.message);
        }

        // Clean up Map to prevent memory leaks for dead channels
        if (lastChannelSend.size > 100) {
            const staleThreshold = Date.now() - (CHANNEL_LIMIT_MS * 2);
            for (const [id, time] of lastChannelSend) {
                if (time < staleThreshold) lastChannelSend.delete(id);
            }
        }
    }

    isProcessing = false;
}

function getQueueStatus() {
    return {
        queued: messageQueue.length,
        processing: isProcessing,
        trackedChannels: lastChannelSend.size
    };
}

module.exports = { queueMessage, getQueueStatus };