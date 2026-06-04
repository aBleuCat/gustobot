// Message queue for multi-layer rate-limited sending
import type {
	TextBasedChannel,
	PartialGroupDMChannel,
	Message,
} from 'discord.js';
import {config} from '../config.js';
import {devLog} from './dev-log.js';

type ReplyInfo = {
	mention: boolean;
	message: Message;
};

type QueueItem = {
	channel: SendableChannel;
	content: string;
	reply: ReplyInfo | undefined;
	priority: number;
	resolve: (value: Message) => void;
	reject: (reason: unknown) => void;
};

type ChannelState = {
	queue: QueueItem[];
	isProcessing: boolean;
	lastSend: number;
};

type SendableChannel = Exclude<
	TextBasedChannel,
	PartialGroupDMChannel
>;

// Constants
const CHANNEL_LIMIT_MS = config.CHANNEL_MSG_LIMIT_MS;
const GLOBAL_LIMIT_MS = config.GLOBAL_MSG_LIMIT_MS;

// Tracking state
let lastGlobalSend = 0;
const channelQueues = new Map<string, ChannelState>();

// Get or initialize a channel's queue state
function getChannelState(channelId: string): ChannelState {
	if (!channelQueues.has(channelId)) {
		channelQueues.set(channelId, {
			queue: [],
			isProcessing: false,
			lastSend: 0,
		});
	}

	return channelQueues.get(channelId)!;
}

// Add a message to its channel's queue, respecting priority order.
// Returns a Promise that resolves with the sent message, or rejects on error.
export async function queueMessage({
	channel,
	content,
	reply,
	priority = 1,
}: {
	channel: SendableChannel;
	content: string;
	reply?: ReplyInfo;
	priority?: number;
}): Promise<Message> {
	const state = getChannelState(channel.id);

	let resolve!: (value: Message) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<Message>((resolution, rejection) => {
		resolve = resolution;
		reject = rejection;
	});

	const item: QueueItem = {
		channel,
		content,
		reply,
		priority,
		resolve,
		reject,
	};

	// Insert before the first item with a strictly lower priority
	const insertIndex = state.queue.findIndex(
		(m) => m.priority < priority,
	);
	if (insertIndex === -1) {
		state.queue.push(item);
	} else {
		state.queue.splice(insertIndex, 0, item);
	}

	const queueLength = state.queue.length;
	if (queueLength > 60) {
		void devLog(
			`Warning: ${queueLength} messages in queue for channel ${channel.id}`,
		);
	} else if (queueLength > 20) {
		console.warn(
			`[Warning] Message queue size reached ${queueLength} for channel ${channel.id}`,
		);
	}

	void processChannelQueue(channel.id);
	return promise;
}

// Wait until both the global and per-channel rate limits are satisfied,
// returning the number of ms to sleep (0 if already ready).
function msUntilReady(state: ChannelState): number {
	const now = Date.now();
	const globalWait = GLOBAL_LIMIT_MS - (now - lastGlobalSend);
	const channelWait = CHANNEL_LIMIT_MS - (now - state.lastSend);
	return Math.max(0, globalWait, channelWait);
}

async function processChannelQueue(channelId: string): Promise<void> {
	const state = channelQueues.get(channelId);
	if (!state || state.isProcessing) return;
	state.isProcessing = true;

	const processNext = async (): Promise<void> => {
		if (state.queue.length === 0) {
			state.isProcessing = false;

			// Clean up idle channel state to prevent memory leaks
			if (channelQueues.size > 100) {
				const staleThreshold =
					Date.now() - CHANNEL_LIMIT_MS * 2;
				for (const [id, s] of channelQueues) {
					if (
						!s.isProcessing &&
						s.queue.length === 0 &&
						s.lastSend < staleThreshold
					) {
						channelQueues.delete(id);
					}
				}
			}

			return;
		}

		const wait = msUntilReady(state);
		if (wait > 0) {
			setTimeout(() => {
				processNext().catch(console.error);
			}, wait);
			return;
		}

		const item = state.queue.shift()!;

		try {
			const sent = await item.channel.send({
				content: item.content,
				...(item.reply?.mention && {
					reply: {messageReference: item.reply.message},
				}),
			});

			const now = Date.now();
			lastGlobalSend = now;
			state.lastSend = now;

			item.resolve(sent);
		} catch (error: unknown) {
			if (error instanceof Error) {
				console.error('Queue send error:', error.message);
			} else {
				console.error('Queue send error:', error);
			}

			item.reject(error);
		}

		await processNext();
	};

	await processNext();
}

export function getQueueStatus(): {
	totalQueued: number;
	activeChannels: number;
	trackedChannels: number;
} {
	let totalQueued = 0;
	let activeChannels = 0;
	for (const state of channelQueues.values()) {
		totalQueued += state.queue.length;
		if (state.isProcessing) activeChannels++;
	}

	return {
		totalQueued,
		activeChannels,
		trackedChannels: channelQueues.size,
	};
}
