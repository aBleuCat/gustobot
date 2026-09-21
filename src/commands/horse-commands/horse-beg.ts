import { type ChatInputCommandInteraction, MessageFlags, SlashCommandSubcommandBuilder } from "discord.js";
import type { UpdateQuery } from "mongoose";
import rawHorseValues from "../../data/horses.json" with { type: "json" };
import { config } from "../../lib/config.js";
import { UserHorses, type IUserHorses } from "../../lib/models.js";
import { castAsHorseData } from "../../type-utils.js";
import { randItem } from "../../lib/helpers/random-helpers.js";
import { horseName } from "../../lib/helpers/horse-funcs.js";

type BegReward = undefined | number | string;
type BegRewardQuality = "unsuccessful" | "successful" | "verySuccessful";

const HORSE_VALUES = castAsHorseData(rawHorseValues);
const { BEG_COOLDOWN } = config;

const begFlavorText: Record<BegRewardQuality, string[]> = {
	unsuccessful: [
		"You were begging on the streets and everyone ignored you. One person looked at you like you were a broke lunatic, which you probably are.",
		"You went up to a person and asked him to spare some horse coins. He spat in your face.",
		"You went up to a person and asked for some horses. He looked nice enough, which is why he was also broke and couldn't give you anything.",
		"Someone saw you begging and told you to get a job. You tried to explain to him about the job market and stuff, but he just slapped you and left.",
		"You saw a dream from a heavenly being. He told you to suck it up like a good boy.",
		"A kid pointed to you and asked his mom if this is what happens if you don't do your homework.",
	],
	successful: [
		"A tourist mistook you for a bad street performer. You didn't correct him",
		"Someone felt bad for you and your broke ass.",
		"You got your tax refunds back.",
		"An old woman put some money in your hand and whispered in your ear to get help.",
		"Begging just got you some weird looks, but you found something between the couch cushions.",
	],
	verySuccessful: [
		"Yo MrBeast showed up and gave everyone a million dollars. He gave you some stuff as well.",
		"You won the lottery! Your gambling addiction will never end.",
		"John Capitalism flew in with a Pegasus and dropped you a gift.",
		"Your maternal great uncle died and you were in the inheritance because he felt pity for you.",
		"Some privileged kids made a bet where the loser would give money to the most helpless stranger they found.",
	],
}

const unsuccessfulBegChance = 0.2;
const verySuccessfulBegChance = 0.05;

function buildBegUpdate(reward: BegReward, now: number): UpdateQuery<IUserHorses> {
	const $set = { lastBeg: new Date(now) };
	if (typeof reward === "number") return { $set, $inc: { horseCoins: reward } };
	if (typeof reward === "string") return { $set, $inc: { [`horses.${reward}`]: 1 } };
	return { $set };
}

type BegTier = Exclude<BegRewardQuality, "unsuccessful">;

const BEG_TIERS: Record<BegTier, { coinMin: number; coinMax: number; horseMin: number; horseMax: number }> = {
	successful: { coinMin: 2, coinMax: 5, horseMin: 25, horseMax: 75 },
	verySuccessful: { coinMin: 8, coinMax: 15, horseMin: 100, horseMax: 150 },
};

function randInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function determineBegReward(): [BegReward, BegRewardQuality] {
	const roll = Math.random();
	if (roll < unsuccessfulBegChance) return [undefined, "unsuccessful"];

	const quality: BegTier =
		roll < unsuccessfulBegChance + verySuccessfulBegChance ? "verySuccessful" : "successful";
	const tier = BEG_TIERS[quality];

	if (Math.random() < 0.5) {
		const candidates = Object.entries(HORSE_VALUES).filter(
			([, horse]) => horse.value >= tier.horseMin && horse.value <= tier.horseMax && horse.comp !== false && horse.spawn !== false,
		);
		const horse = randItem(candidates)?.[0];
		if (horse !== undefined) return [horse, quality];
	}

	return [randInt(tier.coinMin, tier.coinMax), quality];
}

async function tryClaimBeg(userId: string, reward: BegReward, now: number): Promise<boolean> {
	const result = await UserHorses.updateOne(
		{
			userId,
			$or: [{ lastBeg: null }, { lastBeg: { $lte: new Date(now - BEG_COOLDOWN) } }],
		},
		buildBegUpdate(reward, now),
	);
	return result.matchedCount === 1;
}

function describeReward(reward: BegReward, rewardQuality: BegRewardQuality) {
	const secondLine = reward ? (typeof reward === "number" ? `You got **🪙 ${reward} Horse Coins**!` : `You got a **${horseName(reward)}**!`) : "You got NOTHING";
	const flavorText = randItem(begFlavorText[rewardQuality]) ?? "You begged";
	return `${flavorText}\n\n${secondLine}`;
}

export const data = new SlashCommandSubcommandBuilder()
	.setName("beg")
	.setDescription("Beg for a horse/coins daily bc ur broke")

export async function execute(interaction: ChatInputCommandInteraction) {
	const userId = interaction.user.id;
	const now = Date.now();
	const [reward, rewardQuality] = determineBegReward();

	let isBegClaimable = await tryClaimBeg(userId, reward, now);

	if (!isBegClaimable) {
		const ensure = await UserHorses.updateOne(
			{ userId },
			{ $setOnInsert: { userId } },
			{ upsert: true },
		);
		if (ensure.upsertedCount === 1) isBegClaimable = await tryClaimBeg(userId, reward, now);
	}

	if (isBegClaimable) {
		await interaction.reply({ content: describeReward(reward, rewardQuality) });
		return;
	}

	const doc = await UserHorses.findOne({ userId }, { lastBeg: 1 });
	if (!doc?.lastBeg) {
		await interaction.reply({
			content: "Try again in a moment.",
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	const availableAt = Math.floor((doc.lastBeg.getTime() + BEG_COOLDOWN) / 1000);
	await interaction.reply({
		content: `You've begged too recently. Try again <t:${availableAt}:R>.`,
		flags: [MessageFlags.Ephemeral],
	});
}
