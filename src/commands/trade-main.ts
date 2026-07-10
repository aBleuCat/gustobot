import {
	SlashCommandBuilder,
	InteractionContextType,
	ApplicationIntegrationType,
	type ChatInputCommandInteraction,
	type AutocompleteInteraction,
} from "discord.js";
import { SubcommandLoader } from "./lib/subcommand-loader.js";

/* eslint-disable @typescript-eslint/naming-convention */
const { Guild } = InteractionContextType;
const { GuildInstall } = ApplicationIntegrationType;
/* eslint-enable @typescript-eslint/naming-convention */

const mainCommand = new SlashCommandBuilder()
	.setName("trade")
	.setDescription(
		"All commands related to trading horses and horse coins",
	)
	.setContexts([Guild])
	.setIntegrationTypes([GuildInstall]);

const loader = new SubcommandLoader(
	mainCommand,
	import.meta.url,
	"trade-commands",
);

await loader.load();

const tradeCommand = {
	data: mainCommand,
	async execute(interaction: ChatInputCommandInteraction) {
		await loader.execute(interaction);
	},
	async autocomplete(interaction: AutocompleteInteraction) {
		await loader.autocomplete(interaction);
	},
};

export default tradeCommand;
