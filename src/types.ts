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
