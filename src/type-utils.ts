import {
	type GuildTextBasedChannel,
	type TextChannel,
	type NewsChannel,
	ChannelType,
} from 'discord.js';
import type {Horse, HorseData, AnyChannel} from './types.js';

function isHorse(item: unknown): item is Horse {
	return (
		typeof item === 'object' &&
		item !== null &&
		'name' in item &&
		typeof (item as Record<string, unknown>).name === 'string' &&
		'value' in item &&
		typeof (item as Record<string, unknown>).value === 'number' &&
		'link' in item &&
		typeof (item as Record<string, unknown>).link === 'string'
	);
}

export function isHorseData(
	data: unknown,
	mode: 'all' | number = 'all',
): data is Record<string, Horse> {
	if (
		typeof data !== 'object' ||
		data === null ||
		Array.isArray(data)
	) {
		return false;
	}

	const entries = Object.values(data);
	const limit =
		mode === 'all'
			? entries.length
			: Math.min(mode, entries.length);

	for (let i = 0; i < limit; i++) {
		if (!isHorse(entries[i])) {
			return false;
		}
	}

	return true;
}

export function castAsHorseData(
	data: unknown,
	mode: 'all' | number = 5,
): HorseData {
	if (!isHorseData(data, mode)) {
		throw new TypeError(
			'Data (likely horses.json) does not abide by HorseData type',
		);
	}

	return data;
}

function isGuildTextBased(
	channel: AnyChannel,
): channel is GuildTextBasedChannel {
	return channel.isTextBased() && !channel.isDMBased();
}

export function castAsTextBased(
	channel:
		| AnyChannel
		| undefined
		// eslint-disable-next-line @typescript-eslint/no-restricted-types
		| null,
): GuildTextBasedChannel {
	if (channel && isGuildTextBased(channel)) return channel;
	throw new Error(
		`Expected a text-based channel but received: ${channel?.type ?? 'null'}`,
	);
}

export function returnAsTextBased(
	channel:
		| AnyChannel
		| undefined
		// eslint-disable-next-line @typescript-eslint/no-restricted-types
		| null,
): Error | GuildTextBasedChannel {
	let returnValue;
	try {
		returnValue = castAsTextBased(channel);
	} catch (error: unknown) {
		returnValue =
			error instanceof Error
				? error
				: new Error(
						typeof error === 'string' ? error : 'idk',
					);
	}

	return returnValue;
}

function isWebhookableChannel(
	channel: AnyChannel,
): channel is TextChannel | NewsChannel {
	return (
		channel &&
		'type' in channel &&
		(channel.type === ChannelType.GuildText ||
			channel.type === ChannelType.GuildAnnouncement)
	);
}

export function castAsWebhookable(
	// eslint-disable-next-line @typescript-eslint/no-restricted-types
	channel: AnyChannel | null,
): TextChannel | NewsChannel {
	if (channel && isWebhookableChannel(channel)) return channel;
	throw new Error(
		`Expected a text or announcements channel but received: ${channel?.type ?? 'null'}`,
	);
}
