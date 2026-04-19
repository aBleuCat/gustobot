// Message queue for rate-limited sending
// Discord recommends max 5 messages per channel per 5 seconds (1 msg/sec safe)

const messageQueue = [];
let isProcessing = false;
const RATE_LIMIT_MS = 1100; // 1.1 seconds between messages (safe margin)

/**
 * Add a message to the queue
 * @param {Object} options - Message options
 * @param {Object} options.channel - The Discord channel to send to
 * @param {string} options.content - Message content
 * @param {Object} [options.reply] - Reply options { message: msg, mention: boolean }
 */
function queueMessage({ channel, content, reply = null }) {
    messageQueue.push({ channel, content, reply, timestamp: Date.now() });
    processQueue();
}

async function processQueue() {
    if (isProcessing || messageQueue.length === 0) return;
    
    isProcessing = true;
    
    while (messageQueue.length > 0) {
        const item = messageQueue.shift();
        
        try {
            if (item.reply) {
                await item.channel.send({
                    content: item.content,
                    reply: item.reply.mention ? { messageReference: item.reply.message } : undefined
                });
            } else {
                await item.channel.send(item.content);
            }
        } catch (e) {
            console.error("Queue send error:", e.message);
        }
        
        // Wait before next message
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
    }
    
    isProcessing = false;
}

/**
 * Get current queue status
 */
function getQueueStatus() {
    return {
        queued: messageQueue.length,
        processing: isProcessing
    };
}

module.exports = { queueMessage, getQueueStatus };