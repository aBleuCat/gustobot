import type {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	SlashCommandOptionsOnlyBuilder,
	GuildBasedChannel,
	DMChannel,
	PartialDMChannel,
	PartialGroupDMChannel,
	AutocompleteInteraction,
	SlashCommandSubcommandsOnlyBuilder,
	Collection,
} from "discord.js";

export type SlashCommandConfig = {
	data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
	execute(interaction: ChatInputCommandInteraction): Promise<void>;
};

export type SlashCommandModule = SlashCommandConfig & {
	autocomplete?(
		interaction: AutocompleteInteraction,
	): Promise<void>;
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
export type Command = {
	data:
		| SlashCommandBuilder
		| SlashCommandOptionsOnlyBuilder
		| SlashCommandSubcommandsOnlyBuilder;
	execute: (
		interaction: ChatInputCommandInteraction,
	) => Promise<void>;
	autocomplete?: (
		interaction: AutocompleteInteraction,
	) => Promise<void>;
};

declare module "discord.js" {
	// eslint-disable-next-line @typescript-eslint/consistent-type-definitions, no-unused-vars
	interface Client {
		commands: Collection<string, Command>;
	}
}
