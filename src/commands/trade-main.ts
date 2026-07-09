import {
	ActionRowBuilder,
	SlashCommandBuilder,
	InteractionContextType,
	ApplicationIntegrationType,
	type ChatInputCommandInteraction,
	type AutocompleteInteraction,
	EmbedBuilder,
	type User,
	ButtonBuilder,
	ButtonStyle,
	type ButtonInteraction,
	MessageFlags,
} from "discord.js";
import mongoose from "mongoose";
import { UserHorses } from "../lib/models.js";
import { fetchWithTimeout } from "../lib/helpers/timeout-helpers.js";
import { config } from "../lib/config.js";
import dictToEmbed from "../lib/helpers/embed-helpers.js";
import { horseName } from "../lib/helpers/horse-funcs.js";
import { SubcommandLoader } from "./lib/subcommand-loader.js";

/* eslint-disable @typescript-eslint/naming-convention */
const { Guild } = InteractionContextType;
const { GuildInstall } = ApplicationIntegrationType;
/* eslint-enable @typescript-eslint/naming-convention */

export type TradeMember = {
	readonly id: string;
	readonly name: string;
	coinsOffered: number;
	horsesOffered: Record<string, number>;
	locked: boolean;
};

export type ResolvedTradeMember = Readonly<
	Omit<TradeMember, "locked">
>;

export type Color = "red" | "blue";
export type ColorWithUnderwear = "_red" | "_blue";

export type ResolvedTrade = {
	readonly red: ResolvedTradeMember;
	readonly blue: ResolvedTradeMember;
};

function omitKey<
	T extends Record<string, unknown>,
	K extends keyof T,
>(object: T, key: K): Omit<T, K> {
	const { [key]: _, ...rest } = object;
	return rest;
}

class ActiveTrade {
	public readonly promise: Promise<ResolvedTrade | undefined>;
	private resolveFn!: (value: ResolvedTrade) => void;
	private resolveStatus: "active" | "resolved" | "expired" =
		"active";

	private readonly _red: TradeMember;
	private readonly _blue: TradeMember;

	private updateAction?: (
		embeds: EmbedBuilder[],
		buttons: ActionRowBuilder<ButtonBuilder>,
		collector: (interaction: ButtonInteraction) => void,
	) => void;

	// Cached so we don't hand out a fresh closure on every access
	private readonly _collector: (
		interaction: ButtonInteraction,
	) => void;

	constructor(red: User, blue: User) {
		this._red = {
			id: red.id,
			name: red.displayName,
			coinsOffered: 0,
			horsesOffered: {},
			locked: false,
		};
		this._blue = {
			id: blue.id,
			name: blue.displayName,
			coinsOffered: 0,
			horsesOffered: {},
			locked: false,
		};

		const successPromise = new Promise<ResolvedTrade>(
			(resolve) => {
				this.resolveFn = resolve;
			},
		);

		this.promise = fetchWithTimeout(
			successPromise,
			config.TRADE_DURATION,
		);

		void this.promise.then((result) => {
			this.resolveStatus =
				result === undefined ? "expired" : "resolved";
		});

		this._collector = (interaction: ButtonInteraction) => {
			(async (interaction: ButtonInteraction) => {
				if (interaction.customId === "trade_lock") {
					const color = this.colorOf(interaction.user.id);
					if (!color)
						return interaction.reply({
							content: "You cannot do that",
							flags: [MessageFlags.Ephemeral],
						});
					this.lock(color);
					return interaction.reply({
						content:
							"You have successfully locked your trade",
						flags: [MessageFlags.Ephemeral],
					});
				}

				if (interaction.customId === "trade_reset") {
					const color = this.colorOf(interaction.user.id);
					if (!color)
						return interaction.reply({
							content: "You cannot do that",
							flags: [MessageFlags.Ephemeral],
						});
					this.reset(color);
					return interaction.reply({
						content: "You have reset your offer",
						flags: [MessageFlags.Ephemeral],
					});
				}
			})(interaction);
		};
	}

	public onUpdate(
		fn: (
			embeds: EmbedBuilder[],
			buttons: ActionRowBuilder<ButtonBuilder>,
		) => void,
	) {
		this.updateAction = fn;
	}

	public add(user: Color, name: string, amount: number) {
		const userProperty: ColorWithUnderwear = `_${user}`;
		this.checkStatus(userProperty);

		if (name === "coin") {
			this[userProperty].coinsOffered += amount;
		} else {
			const allOffers = this[userProperty].horsesOffered;
			const horseOffer = allOffers[name];
			allOffers[name] = (horseOffer ?? 0) + amount;
		}

		if (this.updateAction)
			this.updateAction(
				this.embeds,
				this.buttons,
				this.collector,
			);
	}

	public remove(user: Color, name: string, amount: number) {
		const userProperty: ColorWithUnderwear = `_${user}`;
		this.checkStatus(userProperty);

		if (name === "coin") {
			this[userProperty].coinsOffered -= amount;
		} else {
			const allOffers = this[userProperty].horsesOffered;
			const horseOffer = allOffers[name];

			if (amount > (horseOffer ?? 0))
				throw new Error(
					"Removal failed because there are not enough horses to remove.",
				);
			allOffers[name] = (horseOffer ?? 0) - amount;
		}

		if (this.updateAction)
			this.updateAction(
				this.embeds,
				this.buttons,
				this.collector,
			);
	}

	public lock(user: Color) {
		this.checkStatus();

		const userProperty: ColorWithUnderwear = `_${user}`;
		this[userProperty].locked = true;

		if (!this._red.locked || !this._blue.locked) return;

		const result: ResolvedTrade = {
			red: omitKey(this._red, "locked"),
			blue: omitKey(this._blue, "locked"),
		};

		this.resolveFn(result);

		if (this.updateAction)
			this.updateAction(
				this.embeds,
				this.buttons,
				this.collector,
			);
	}

	public colorOf(userId: string) {
		if (this._red.id === userId) return "red";
		if (this._blue.id === userId) return "blue";
		return undefined;
	}

	public reset(user: Color) {
		const userProperty: ColorWithUnderwear = `_${user}`;
		this.checkStatus(userProperty);

		this[userProperty].coinsOffered = 0;
		this[userProperty].horsesOffered = {};

		if (this.updateAction)
			this.updateAction(
				this.embeds,
				this.buttons,
				this.collector,
			);
	}

	public get red() {
		return this._red;
	}

	public get blue() {
		return this._blue;
	}

	public get embeds(): EmbedBuilder[] {
		function setupEmbed(user: TradeMember) {
			const fields = {
				Coins: user.coinsOffered,
				...Object.fromEntries(
					Object.entries(user.horsesOffered).map(
						([slug, amount]) => [
							horseName(slug) ?? slug,
							amount,
						],
					),
				),
			};
			return dictToEmbed(user.name, fields, "leaderboard");
		}

		return [this._red, this._blue].map((user) =>
			setupEmbed(user).setFooter({
				text: `This user's offer is ${user.locked ? "LOCKED" : "unlocked"}`,
			}),
		);
	}

	public get buttons(): ActionRowBuilder<ButtonBuilder> {
		const lockButton = new ButtonBuilder()
			.setCustomId("trade_lock")
			.setLabel("Lock")
			.setStyle(ButtonStyle.Primary);
		const resetButton = new ButtonBuilder()
			.setCustomId("trade_reset")
			.setLabel("Reset")
			.setStyle(ButtonStyle.Danger);
		return new ActionRowBuilder<ButtonBuilder>().addComponents(
			lockButton,
			resetButton,
		);
	}

	public get collector() {
		return this._collector;
	}

	private checkStatus(user?: ColorWithUnderwear) {
		if (user && this[user].locked)
			throw new Error(
				"The user is locked. The action cannot proceed.",
			);
		if (this.resolveStatus === "resolved")
			throw new Error(
				"This trade has been resolved and is no longer open to new offers.",
			);
		if (this.resolveStatus === "expired")
			throw new Error("This trade has expired.");
	}
}

export type TradeApplyResult =
	| { success: true }
	| { success: false; reason: string };

function buildIncAndFilter(
	userId: string,
	gives: ResolvedTradeMember,
	receives: ResolvedTradeMember,
) {
	const inc: Record<string, number> = {
		horseCoins: receives.coinsOffered - gives.coinsOffered,
	};
	const filter: Record<string, unknown> = { userId };

	if (gives.coinsOffered > 0)
		filter.horseCoins = { $gte: gives.coinsOffered };

	const slugs = new Set([
		...Object.keys(gives.horsesOffered),
		...Object.keys(receives.horsesOffered),
	]);

	for (const slug of slugs) {
		const give = gives.horsesOffered[slug] ?? 0;
		const receive = receives.horsesOffered[slug] ?? 0;
		inc[`horses.${slug}`] = receive - give;

		if (give > 0) filter[`horses.${slug}`] = { $gte: give };
	}

	return { inc, filter };
}

export async function applyTradeResult(
	result: ResolvedTrade,
): Promise<TradeApplyResult> {
	const { red, blue } = result;

	const redUpdate = buildIncAndFilter(red.id, red, blue);
	const blueUpdate = buildIncAndFilter(blue.id, blue, red);

	const session = await mongoose.startSession();

	try {
		let redResult;
		let blueResult;

		await session.withTransaction(async () => {
			redResult = await UserHorses.findOneAndUpdate(
				redUpdate.filter,
				{ $inc: redUpdate.inc },
				{ session, upsert: false, new: true },
			);

			blueResult = await UserHorses.findOneAndUpdate(
				blueUpdate.filter,
				{ $inc: blueUpdate.inc },
				{ session, upsert: false, new: true },
			);

			if (!redResult || !blueResult)
				throw new Error("insufficient balance");
		});

		return { success: true };
	} catch {
		return {
			success: false,
			reason: "One or both users no longer have enough coins or horses to cover this trade.",
		};
	} finally {
		await session.endSession();
	}
}

function offerLines(member: ResolvedTradeMember): string {
	const lines: string[] = [];

	if (member.coinsOffered > 0)
		lines.push(`🪙 ${member.coinsOffered} coin`);

	for (const [slug, amount] of Object.entries(
		member.horsesOffered,
	)) {
		if (amount > 0)
			lines.push(`🐴 ${amount}x ${horseName(slug) ?? slug}`);
	}

	return lines.length > 0 ? lines.join("\n") : "nothing";
}

export function buildConfirmEmbed(
	result: ResolvedTrade,
): EmbedBuilder {
	return new EmbedBuilder()
		.setTitle("Confirm Trade")
		.setColor("#fab387")
		.setDescription(
			"Both users must accept for this trade to go through.",
		)
		.addFields(
			{
				name: result.red.name,
				value: `**Gives:**\n${offerLines(result.red)}`,
				inline: true,
			},
			{
				name: result.blue.name,
				value: `**Gives:**\n${offerLines(result.blue)}`,
				inline: true,
			},
		);
}

export function buildAcceptedEmbed(
	result: ResolvedTrade,
): EmbedBuilder {
	return new EmbedBuilder()
		.setTitle("✅ Trade Accepted")
		.setColor("#a6e3a1")
		.addFields(
			{
				name: result.red.name,
				value: `**Gave:**\n${offerLines(result.red)}\n\n**Received:**\n${offerLines(result.blue)}`,
				inline: true,
			},
			{
				name: result.blue.name,
				value: `**Gave:**\n${offerLines(result.blue)}\n\n**Received:**\n${offerLines(result.red)}`,
				inline: true,
			},
		)
		.setFooter({ text: "Balances have been updated" })
		.setTimestamp();
}

export function buildFailedEmbed(reason: string): EmbedBuilder {
	return new EmbedBuilder()
		.setTitle("❌ Trade Failed")
		.setColor("#f38ba8")
		.setDescription(reason);
}

export function buildExpiredEmbed(): EmbedBuilder {
	return new EmbedBuilder()
		.setTitle("⌛ Trade Expired")
		.setColor("#6c7086")
		.setDescription("Neither user locked in time.");
}

export function buildDeclinedEmbed(
	declinerName: string,
): EmbedBuilder {
	return new EmbedBuilder()
		.setTitle("🚫 Trade Declined")
		.setColor("#f38ba8")
		.setDescription(
			`${declinerName} declined the trade. No balances were changed.`,
		);
}

export function buildConfirmTimeoutEmbed(): EmbedBuilder {
	return new EmbedBuilder()
		.setTitle("⌛ Confirmation Timed Out")
		.setColor("#6c7086")
		.setDescription(
			"Not both users accepted in time. No balances were changed.",
		);
}

class TradeMain {
	public static getInstance(): TradeMain {
		TradeMain.instance ||= new TradeMain();
		return TradeMain.instance;
	}

	private static instance: TradeMain;
	private readonly trades = new Map<string, ActiveTrade>();

	private constructor() {
		// To banana or not to banana
	}

	public new(
		channelId: string,
		red: User,
		blue: User,
	): ActiveTrade {
		if (this.trades.has(channelId))
			throw new Error(
				"A trade is already active in this channel.",
			);

		const trade = new ActiveTrade(red, blue);
		this.trades.set(channelId, trade);

		void trade.promise.finally(() => {
			if (this.trades.get(channelId) === trade)
				this.trades.delete(channelId);
		});

		return trade;
	}

	public get(channelId: string): ActiveTrade | undefined {
		return this.trades.get(channelId);
	}

	public has(channelId: string): boolean {
		return this.trades.has(channelId);
	}

	public end(channelId: string): boolean {
		return this.trades.delete(channelId);
	}

	public all(): Map<string, ActiveTrade> {
		return this.trades;
	}
}

export const tradeMain = TradeMain.getInstance();

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
