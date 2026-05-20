import {
	type SlashCommandBuilder,
	type ChatInputCommandInteraction,
	type SlashCommandOptionsOnlyBuilder,
	type GuildBasedChannel,
	type DMChannel,
	type PartialDMChannel,
	type PartialGroupDMChannel,
	type Guild,
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
export type AnyChannel =
	| GuildBasedChannel
	| DMChannel
	| PartialDMChannel
	| PartialGroupDMChannel;

declare module 'discord.js' {
	// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
	interface Client {
		logToModChannel: (guild: Guild, message: string) => Promise<void>;
	}
}
