import {
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
	type AutocompleteInteraction,
	InteractionContextType,
	ApplicationIntegrationType,
} from "discord.js";
import { SubcommandLoader } from "./lib/subcommand-loader.js";

export type RaceChallenge = {
	redId: string;
	blueId: string;
};

export const raceChallenges = new Map<string, RaceChallenge>();

/* eslint-disable @typescript-eslint/naming-convention */
const { Guild } = InteractionContextType;
const { GuildInstall } = ApplicationIntegrationType;
/* eslint-enable @typescript-eslint/naming-convention */

const mainCommand = new SlashCommandBuilder()
	.setName("race")
	.setDescription("Horse racing!")
	.setContexts([Guild])
	.setIntegrationTypes([GuildInstall]);

const loader = new SubcommandLoader(
	mainCommand,
	import.meta.url,
	"race-commands",
);

await loader.load();

const raceCommand = {
	data: mainCommand,
	async execute(interaction: ChatInputCommandInteraction) {
		await loader.execute(interaction);
	},
	async autocomplete(interaction: AutocompleteInteraction) {
		await loader.autocomplete(interaction);
	},
};

export default raceCommand;
