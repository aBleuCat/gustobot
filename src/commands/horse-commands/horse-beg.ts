import { type ChatInputCommandInteraction, MessageFlags, SlashCommandSubcommandBuilder } from "discord.js";
import type { UpdateQuery } from "mongoose";
import rawHorseValues from "../../data/horses.json" with { type: "json" };
import { config } from "../../lib/config.js";
import { UserHorses, type IUserHorses } from "../../lib/models.js";
import { castAsHorseData } from "../../type-utils.js";
import { randInt, randItem } from "../../lib/helpers/random-helpers.js";
import { horseName } from "../../lib/helpers/horse-funcs.js";

type BegReward = undefined | number | string;
type BegRewardQuality = "unsuccessful" | "successful" | "verySuccessful";
type StreakReward = { horse?: string; coins?: number };

const HORSE_VALUES = castAsHorseData(rawHorseValues);
const { BEG_COOLDOWN } = config;
const MAX_BEG_STREAK_GAP = BEG_COOLDOWN * 2;

const streakRewardMilestones: Record<number, StreakReward> = {
	5: { horse: "peasantry_beggary" },
	10: { horse: "patience_wisdom", coins: 5 },
	20: { horse: "noobs_baseplates", coins: 8 },
	30: { horse: "skinniness_malnutrition", coins: 10 },
	120: { horse: "gildedness_stratification", coins: 20 },
	365: { horse: "suicide_stuyvesant", coins: 40 },
	1826: { horse: "brightness_prosperity", coins: 80 }, // 5 years, including a leap year
	3652: { horse: "unicorn", coins: 150 }, // 10 years, including 2 leap years
	18_262: { horse: "pegasus", coins: 200 }, // 50 years, including 12 leap years
	36_524: { horse: "john_kim", coins: 500 }, // 100 years, including 24 leap years
};

const recurringStreakRewards = [
	{ start: 10, every: 4, horse: "peasantry_beggary", coins: 2 },
	{ start: 30, every: 20, horse: "noobs_baseplates", coins: 8 },
];

function determineStreakReward(day: number): undefined | StreakReward {
	const milestoneReward = (Object.entries(streakRewardMilestones)
		.find(([milestone]) => Number(milestone) === day))?.[1];
	if (milestoneReward) return milestoneReward;
	const recurringReward = recurringStreakRewards
		.find(({ start, every }) => day >= start && day % every === 0);
	if (recurringReward) { return {
		horse: recurringReward.horse,
		coins: recurringReward.coins,
	}; }

	return undefined;
}

function nextStreakReward(day: number): number | undefined {
	const milestoneRewardDistances = Object.keys(streakRewardMilestones)
		.map((milestone) => Number(milestone) - day)
		.filter((dist) => dist > 0);
	const recurringRewardDistances = recurringStreakRewards
		.map(({ start, every }) => {
			const nextMultiple = Math.max(Math.floor(day / every) + 1, Math.ceil(start / every)) * every;
			return nextMultiple - day;
		});
	const closest = Math.min(...milestoneRewardDistances, ...recurringRewardDistances);
	if (!Number.isFinite(closest)) return undefined;
	return closest;
}

function describeStreakReward(reward: StreakReward | undefined, streak: number): string {
	const horsePart = reward?.horse && ` an additional **${horseName(reward.horse)}**`;
	const coinPart = reward?.coins 
		? ` ${reward.horse ? "and " : ""}**${reward.coins}** more Horse Coins!`
		: "";
	const obtainedLine = reward
		? `Your streak of ${streak} days got you${horsePart}${coinPart}`
		: "";
	const nextStreakDate = nextStreakReward(streak);
	if (!nextStreakDate) console.error("Failed to calculate next streak date. Likely because there are no streak rewards.");
	const nextStreakLine = `Your next streak reward will be ${nextStreakDate 
		? `${nextStreakDate.toString()} day${nextStreakDate > 1 ? "s" : ""}`
		: "in unknown days (this is a bug)"}!`;
	const streakLine = reward ? "" : `You've been begging for ${streak} days in a row!`;
	return `${streakLine}${obtainedLine}\n${nextStreakLine}`;
}

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

function buildBegUpdate(reward: BegReward, now: number, begStreak: number, streakReward: StreakReward): UpdateQuery<IUserHorses> {
	const $set = { lastBeg: new Date(now), begStreak };
	const horseCoins = (typeof reward === "number" ? reward : 0) + (streakReward.coins ?? 0);
	const $inc: Record<string, number> = { horseCoins };
	if (streakReward.horse) $inc[`horses.${streakReward.horse}`] = 1;
	if (typeof reward === "string") $inc[`horses.${reward}`] = 1;
	return { $set, $inc };
}

type BegTier = Exclude<BegRewardQuality, "unsuccessful">;

const BEG_TIERS: Record<BegTier, { coinMin: number; coinMax: number; horseMin: number; horseMax: number }> = {
	successful: { coinMin: 2, coinMax: 5, horseMin: 25, horseMax: 75 },
	verySuccessful: { coinMin: 8, coinMax: 15, horseMin: 100, horseMax: 150 },
};

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

async function tryClaimBeg(
	userId: string,
	reward: BegReward,
	now: number,
	streak: { begStreak: number; reward: StreakReward },
): Promise<boolean> {
	const result = await UserHorses.updateOne(
		{
			userId,
			$or: [{ lastBeg: null }, { lastBeg: { $lte: new Date(now - BEG_COOLDOWN) } }],
		},
		buildBegUpdate(reward, now, streak.begStreak, streak.reward),
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
	const leanInv = await UserHorses.findOne({ userId }, { begStreak: 1, lastBeg: 1 }).lean();
	const lastBegTime = leanInv?.lastBeg?.getTime();
	const previousBegStreak = leanInv?.begStreak ?? 0;
	const isStreakContinuing = lastBegTime !== undefined && now - lastBegTime <= MAX_BEG_STREAK_GAP;
	const didLoseBegStreak = lastBegTime !== undefined
		&& previousBegStreak > 0
		&& now - lastBegTime > MAX_BEG_STREAK_GAP;
	const begStreak = isStreakContinuing ? previousBegStreak + 1 : 1;
	const [reward, rewardQuality] = determineBegReward();
	const streakReward = determineStreakReward(begStreak);
	const streak = { begStreak, reward: streakReward ?? {} };

	let isBegClaimable = await tryClaimBeg(userId, reward, now, streak);

	if (!isBegClaimable) {
		const ensure = await UserHorses.updateOne(
			{ userId },
			{ $setOnInsert: { userId } },
			{ upsert: true },
		);
		if (ensure.upsertedCount === 1) isBegClaimable = await tryClaimBeg(userId, reward, now, streak);
	}

	if (isBegClaimable) {
		const streakResetMessage = didLoseBegStreak
			? `Your **${previousBegStreak}-day begging streak ended.** You're starting over.\n\n`
			: "";
		await interaction.reply({ 
			content: `${streakResetMessage}${describeReward(reward, rewardQuality)}\n\n${describeStreakReward(streakReward, begStreak)}` 
		});
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
