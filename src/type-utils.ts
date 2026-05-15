import type {GuildBasedChannel, GuildTextBasedChannel} from 'discord.js';
import type {Horse, HorseData} from './types.js';

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
	if (typeof data !== 'object' || data === null || Array.isArray(data)) {
		return false;
	}

	const entries = Object.values(data);
	const limit =
		mode === 'all' ? entries.length : Math.min(mode, entries.length);

	for (let i = 0; i < limit; i++) {
		if (!isHorse(entries[i])) {
			return false;
		}
	}

	return true;
}

export function castAsHorseData(
	data: unknown,
	mode: 'all' | number = 'all',
): HorseData {
	if (!isHorseData(data, mode)) {
		throw new TypeError(
			'Data (likely horses.json) does not abide by HorseData type',
		);
	}

	return data;
}

export function castAsTextBased(
	// eslint-disable-next-line @typescript-eslint/no-restricted-types
	channel: GuildBasedChannel | undefined | null,
): GuildTextBasedChannel {
	if (channel?.isTextBased()) return channel;
	throw new Error(
		`Expected a text-based channel but received: ${channel?.type ?? 'null'}`,
	);
}
