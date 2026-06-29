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

export type PoolQuestion = {
	question: string;
	image?: string | string[];
	answer: RegExp;
	answerTxt: string;
};
/** * The data type to input into newQuiz() */
export type PreQuiz = {
	title: string;
	delay: number;
	/**
	 * If you wish to pull from multiple pools, put the pools in an array.
	 * @example pool: "pool1"
	 * @example pool: ["pool1", "pool2"]
	 */
	pool: string | string[];
	rounds: number;
	ansWindow: number;
	/** @todo Haven't added prize capibilities yet */
	prize?: string;
	/**
	 * * **Questions** means that questions can repeat but the same image cannot. E.g., you can get times square twice but not same image of it
	 * * **All** means that both images and questions can repeat
	 */
	repeat: "none" | "questions" | "all";
};
/**
 * Represents a quiz actively managed by quiz handlers and in use for discord
 * @internal This type should not be constructed manually
 */
export type ActiveQuiz = {
	remainingPool: PoolQuestion[];
	currentQuestion: {
		question: string;
		answer: RegExp;
		answerTxt: string;
		status: "idle" | "open" | "closed";
		image?: string | string[];
	};
	scores: Record<string, number>;
	/** * The timer for the current question; when the round ends, the timer is here so that it is easy to clear */
	timer?: NodeJS.Timeout | undefined;
	startTime?: number;
	normalize?:
		| undefined
		| ((value: string) => string)
		| Array<(value: string) => string>;
} & PreQuiz;
export type Pool = {
	metadata?: {
		/** * Runs on any incoming message before testing against the answer regex.
		 */
		normalizer?: (value: string) => string;
	};
	pool: PoolQuestion[];
};

declare module "discord.js" {
	// eslint-disable-next-line @typescript-eslint/consistent-type-definitions, no-unused-vars
	interface Client {
		commands: Collection<string, Command>;
	}
}
