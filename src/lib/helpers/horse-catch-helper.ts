import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	type Channel,
	type Message,
} from "discord.js";
import type { Horse } from "../../types.js";
import { CatchRiddles, UserHorses } from "../models.js";
import { config } from "../config.js";
import { weightedRandom } from "./random-helpers.js";
import { recordUserStatsAndNotify } from "./user-stats.js";

const { CATCH_DURATION_MS } = config;

class ActiveHorseCatch {
	private claimed: boolean;
	public readonly timestamp: Temporal.Instant;
	constructor(
		public readonly rewards: {
			coins?: number;
			horse: [string, Horse];
		},
		private readonly message: Message,
		public readonly answer: RegExp,
		private readonly catchId: string,
	) {
		this.timestamp = Temporal.Now.instant();
		this.claimed = false;
	}

	public get isExpired() {
		return (
			Temporal.Instant.compare(
				this.timestamp.add({
					milliseconds: CATCH_DURATION_MS,
				}),
				Temporal.Now.instant(),
			) <= 0
		);
	}

	public isForMessage(messageId: string | undefined) {
		return this.message.id === messageId;
	}

	public async claim(userId: string) {
		if (this.claimed || this.isExpired) {
			return false;
		}

		this.claimed = true;

		const horseSlug = this.rewards.horse[0];
		const horse = this.rewards.horse[1];
		const { coins } = this.rewards;
		let oldInventory;
		try {
			oldInventory = await UserHorses.findOneAndUpdate(
				{ userId },
				{
					$inc: {
						[`horses.${horseSlug}`]: 1,
						...(coins && { horseCoins: coins }),
					},
				},
				{ upsert: true, setDefaultsOnInsert: true },
			);
		} catch (error: unknown) {
			this.claimed = false;
			throw error;
		}

		try {
			await recordUserStatsAndNotify(
				userId,
				{
					increments: {
						"catches.totalCatches": 1,
						"catches.totalCatchValue": horse.value,
					},
					maxima: {
						"catches.highestCatchValue": horse.value,
					},
				},
				async (payload) => this.message.reply(payload),
			);
		} catch (error: unknown) {
			console.error(
				"Failed to record horse catch stats",
				error,
			);
		}

		let content = `<@${userId}> has caught the **${horse.name}**!`;
		if (
			!oldInventory ||
			(oldInventory.horses.get(horseSlug) ?? 0) <= 0
		) {
			content +=
				"\nThis is a new horse that has been added to your collection!";
		}

		if (coins) {
			content += `\n\nYou also recieved 🪙 **${coins} Horse Coins**!`;
		}

		if (activeHorseCatches.get(this.catchId) === this) {
			activeHorseCatches.delete(this.catchId);
		}

		await this.disableButton();
		return {
			content,
			allowedMentions: { repliedUser: false },
		};
	}

	public async disableButton() {
		await this.message
			.edit({
				components: [
					new ActionRowBuilder<ButtonBuilder>().addComponents(
						new ButtonBuilder()
							.setLabel("Catch")
							.setCustomId(
								`catch_horse_${this.catchId}`,
							)
							.setStyle(ButtonStyle.Primary)
							.setDisabled(true),
					),
				],
			})
			.catch((error: unknown) => {
				console.error(
					"Failed to disable horse catch button",
					error,
				);
			});
	}
}

export const activeHorseCatches = new Map<string, ActiveHorseCatch>();
const fallbackRiddle = {
	riddle: "What rhymes with course and gallops?",
	answer: /^(?:a )?horses?$/iv,
	highestRarity: 1e4,
	lowestRarity: 0,
};

/* eslint-disable jsdoc/check-param-names, jsdoc/require-param -- fsr it's acting up */
/**
 Create a horse catch message, and updates the active horse catches map.
 @param channel The channel in which the horse should be caught
 @param hasJustSpawned Whether or not this horse was just spawned and autoreleased
 @param releaser The user id of the user who released the horse
 @param rewards The rewards (horse and optionally coins) that the catcher recieves
 @param rewards.coins Optionally, the number of coins the catcher recieves
 @param rewards.horse The horse to be caught
 */
export async function createHorseCatch(
	/* eslint-enable jsdoc/check-param-names, jsdoc/require-param */
	channel: Channel,
	{
		hasJustSpawned,
		releaser,
	}: { hasJustSpawned: boolean; releaser?: string },
	rewards: { horse: [string, Horse]; coins?: number },
) {
	if (!channel.isSendable()) {
		throw new Error(
			`Cannot send a message in channel ${channel.id}, so horse catch message cannot be sent`,
		);
	}

	const { horse } = rewards;
	const { rarity } = horse[1];
	const channelId = channel.id;
	const matchedRiddles = await CatchRiddles.find({
		highestRarity: { $gte: rarity },
		lowestRarity: { $lte: rarity },
	});
	const riddle =
		weightedRandom(matchedRiddles, (item) => item.weight) ??
		fallbackRiddle;

	let catchIdNumber = 0;
	while (activeHorseCatches.has(`${channelId}:${catchIdNumber}`)) {
		catchIdNumber += 1;
	}

	const catchId = `${channelId}:${catchIdNumber}`;

	const spawnMessageBeginning = hasJustSpawned
		? `<@${releaser ?? "unknown"}> found a horse, but they let it go.`
		: releaser
			? `<@${releaser}> has released this horse back into the wild.`
			: "A horse was spotted prancing in the wild.";
	const content = `${spawnMessageBeginning}\nSolve this riddle and the profundity of your wisdom will grant you this stallion:\n\n*${riddle.riddle}*`;
	const actionRow =
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setLabel("Catch")
				.setCustomId(`catch_horse_${catchId}`)
				.setStyle(ButtonStyle.Primary),
		);

	const message = await channel.send({
		content: `${content}\n[------------------------------------](${horse[1].link})`,
		components: [actionRow],
		allowedMentions: { parse: [] },
	});

	const activeCatch = new ActiveHorseCatch(
		rewards,
		message,
		riddle.answer,
		catchId,
	);
	activeHorseCatches.set(catchId, activeCatch);

	setTimeout(() => {
		if (activeHorseCatches.get(catchId) === activeCatch) {
			activeHorseCatches.delete(catchId);
		}

		void activeCatch.disableButton();
	}, CATCH_DURATION_MS);
}
