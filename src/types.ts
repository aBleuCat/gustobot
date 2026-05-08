import {
	type SlashCommandBuilder,
	type ChatInputCommandInteraction,
	type SlashCommandOptionsOnlyBuilder,
} from 'discord.js';

export type SlashCommandConfig = {
	data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
	execute(interaction: ChatInputCommandInteraction): Promise<void>;
};
export type Horse = {
	name: string;
	value: number;
	link: string;
	comp?: boolean;
	spawn?: boolean;
	getByGamble?: boolean;
};
export type HorseData = Record<string, Horse>;

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
