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

type ActiveTradeMember = {
	readonly id: string;
	coinsOffered: number;
	horsesOffered: Record<string, number>;
};

type Color = "red" | "blue";
type ColorWithUnderwear = "_red" | "_blue";

class ActiveTrade {
	private readonly _red: ActiveTradeMember;

	private readonly _blue: ActiveTradeMember;

	constructor(redId: string, blueId: string) {
		this._red = {
			id: redId,
			coinsOffered: 0,
			horsesOffered: {},
		};
		this._blue = {
			id: blueId,
			coinsOffered: 0,
			horsesOffered: {},
		};
	}

	public add(user: Color, name: string, amount: number) {
		const userProperty: ColorWithUnderwear = `_${user}`;
		if (name === "coin") {
			this[userProperty].coinsOffered += amount;
			return;
		}

		const allOffers = this[userProperty].horsesOffered;
		const horseOffer = allOffers[name];
		allOffers[name] = (horseOffer ?? 0) + amount;
	}

	public remove(user: Color, name: string, amount: number) {
		const userProperty: ColorWithUnderwear = `_${user}`;
		if (name === "coin") {
			this[userProperty].coinsOffered -= amount;
			return;
		}

		const allOffers = this[userProperty].horsesOffered;
		const horseOffer = allOffers[name];

		if (horseOffer && amount > horseOffer)
			throw new Error("Removal failed because there are not enough horses to remove");
		allOffers[name] = (horseOffer ?? 0) - amount;
	}

	public get red() {
		return this._red;
	}

	public get blue() {
		return this._blue;
	}
}

const tradeMain = {
	activeTradeMap: new Map<string, ActiveTrade>(),
	new(channelId: string, redId: string, blueId: string) {
		this.activeTradeMap.set(channelId, new ActiveTrade(redId, blueId));
	},
};

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
