import mongoose from "mongoose";

export type IRule = {
	ruleId: string;
	watchUser: string;
	targetUser: string;
	channel: string;
	addRole: string;
	restoreRole: string;
	durationMs: number;
} & mongoose.Document;
export type IActionResponse = {
	trigger: string;
	response: string;
} & mongoose.Document;
export type IAdvice = {
	content: string;
	authorId: string;
} & mongoose.Document;
export type IAdviceBan = {
	userId: string;
} & mongoose.Document;
export type ITimeout = {
	guildId: string;
	targetUser: string;
	addRole: string;
	restoreRole: string;
	revertAt: number;
} & mongoose.Document;
export type IModChannel = {
	guildId: string;
	channelId: string;
} & mongoose.Document;
export type IMutedChannel = {
	channelId: string;
} & mongoose.Document;
export type ILolStats = {
	id: string;
	allTime: number;
	weekly: number;
	daily: number;
	lastTimestamp: number;
	lastDay: string;
	lastWeek: number;
} & mongoose.Document;
export type IHorseConfig = {
	guildId: string;
	enabled: boolean;
	channelId: string;
} & mongoose.Document;
export type IUserHorses = {
	userId: string;
	lastGamble: number;
	horseCoins: number;
	horses: Map<string, number>;
	lastHorse?: string;
	lastBeg?: Date;
	begStreak?: number;
} & mongoose.Document;
const horsesSpawnPingSetting = {
	Always: "always",
	Rare: "rare",
	VeryRare: "very_rare",
	Never: "never",
} as const;
export type HorsesSpawnPingSetting =
	(typeof horsesSpawnPingSetting)[keyof typeof horsesSpawnPingSetting];
export type ISettings = {
	userId: string;
	horsesOptIn: boolean;
	horsesSpawnPing: HorsesSpawnPingSetting;
};
export type IMessageCache = {
	userId: string;
	guildId: string;
	lastMessageTime: number;
	recentMessages: string[];
} & mongoose.Document;
export type IPingResponse = {
	message: string;
	weight: number;
	trigger: {
		// eslint-disable-next-line @typescript-eslint/no-restricted-types
		type: "contains" | "author" | "exact" | null;
		// eslint-disable-next-line @typescript-eslint/no-restricted-types
		text: string | null;
	};
} & mongoose.Document;
export type IOrbitalScript = {
	name: string;
	code: string;
} & mongoose.Document;
export type ITrainedHorsesProps = {
	ownerId: string;
	name: string;
	breed: string;
	speedModifier: number; // The modifier on the breed's base speed that yeilds speed. It's here for easier balancing.
	speed: number;
	xp: number;
};
export type ITrainedHorses = ITrainedHorsesProps & mongoose.Document;

export type IGamblingUserStats = {
	wins: number;
	losses: number;
	highestWin: number;
	highestLoss: number;
	highestGamblingStreak: number;
	totalDollarsGambled: number;
	totalDollarsWon: number;
	totalDollarsLost: number;
	totalCoinsGambled: number;
	totalCoinsWon: number;
	totalCoinsLost: number;
};
export type ISpawnUserStats = {
	totalSpawns: number;
	totalSpawnsValue: number;
	highestValueSpawn: number;
	messagesCounted: number;
};
export type IBegUserStats = {
	begs: number;
};
export type IDonationUserStats = {
	totalGiven: number;
	totalRecieved: number;
	highestGiven: number;
	highestRecieved: number;
};
export type ILeaderboardUserStats = {
	highestPosition: number | undefined;
};
export type IRacesUserStats = {
	racesWon: number;
	racesLost: number;
};
export type ITradeUserStats = {
	tradesCompleted: number;
	totalDollarsGiven: number;
	totalDollarsRecieved: number;
	totalCoinsGiven: number;
	totalCoinsRecieved: number;
};
export type ITimeframeStats = {
	gambling: IGamblingUserStats;
	spawns: ISpawnUserStats;
	begs: IBegUserStats;
	donations: IDonationUserStats;
	races: IRacesUserStats;
	leaderboard: ILeaderboardUserStats;
	trades: ITradeUserStats;
	nextRefresh: Date;
	readonly nextRefreshTemporal: Temporal.Instant;
};
export type IUserStats = {
	userId: string;
	daily: ITimeframeStats;
	weekly: ITimeframeStats;
	allTime: Omit<
		ITimeframeStats,
		"nextRefresh" | "nextRefreshTemporal"
	>;
};
export type ITimeframeQuests = {
	claimed: string[];
	unclaimed: string[];
	nextRefresh: Date;
	readonly nextRefreshTemporal: Temporal.Instant;
	rerollsUsed: number;
};
export type IUserQuests = {
	userId: string;
	daily: ITimeframeQuests;
	weekly: ITimeframeQuests;
};

const ruleSchema = new mongoose.Schema<IRule>({
	ruleId: String,
	watchUser: String,
	targetUser: String,
	channel: String,
	addRole: String,
	restoreRole: String,
	durationMs: Number,
});
/* eslint-disable unicorn/no-top-level-side-effects -- shut up */
ruleSchema.index({ watchUser: 1 });
ruleSchema.index({ channel: 1 });
ruleSchema.index({ watchUser: 1, channel: 1 });
/* eslint-enable unicorn/no-top-level-side-effects */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const Rule = mongoose.model<IRule>("Rule", ruleSchema);
// eslint-disable-next-line @typescript-eslint/naming-convention
export const ActionResponse = mongoose.model(
	"ActionResponse",
	new mongoose.Schema<IActionResponse>({
		trigger: String,
		response: String,
	}),
);
// eslint-disable-next-line @typescript-eslint/naming-convention
export const Advice = mongoose.model(
	"Advice",
	new mongoose.Schema<IAdvice>({
		content: String,
		authorId: String,
	}),
);
// eslint-disable-next-line @typescript-eslint/naming-convention
export const AdviceBan = mongoose.model(
	"AdviceBan",
	new mongoose.Schema<IAdviceBan>({
		userId: String,
	}),
);
const timeoutSchema = new mongoose.Schema<ITimeout>({
	guildId: String,
	targetUser: String,
	addRole: String,
	restoreRole: String,
	revertAt: Number,
});
// eslint-disable-next-line unicorn/no-top-level-side-effects
timeoutSchema.index({ revertAt: 1 });
// eslint-disable-next-line @typescript-eslint/naming-convention
export const Timeout = mongoose.model("Timeout", timeoutSchema);

const modChannelSchema = new mongoose.Schema<IModChannel>({
	guildId: String,
	channelId: String,
});
// eslint-disable-next-line unicorn/no-top-level-side-effects
modChannelSchema.index({ guildId: 1 });
// eslint-disable-next-line @typescript-eslint/naming-convention
export const ModChannel = mongoose.model(
	"ModChannel",
	modChannelSchema,
);

// eslint-disable-next-line @typescript-eslint/naming-convention
export const MutedChannel = mongoose.model(
	"MutedChannel",
	new mongoose.Schema<IMutedChannel>({
		channelId: String,
	}),
);

// eslint-disable-next-line @typescript-eslint/naming-convention
export const LolStats = mongoose.model(
	"LolStats",
	new mongoose.Schema<ILolStats>({
		id: { type: String, default: "global_stats" },
		allTime: { type: Number, default: 0 },
		weekly: { type: Number, default: 0 },
		daily: { type: Number, default: 0 },
		lastTimestamp: { type: Number, default: 0 },
		lastDay: { type: String, default: "" },
		lastWeek: { type: Number, default: 0 },
	}),
);

// eslint-disable-next-line @typescript-eslint/naming-convention
export const HorseConfig = mongoose.model(
	"HorseConfig",
	new mongoose.Schema<IHorseConfig>({
		guildId: String,
		enabled: Boolean,
		channelId: String,
	}),
);

const userHorsesSchema = new mongoose.Schema<IUserHorses>({
	userId: { type: String, required: true, unique: true },
	lastGamble: { type: Number, default: 0 },
	horseCoins: {
		type: Number,
		default: 0,
		min: -9_007_199_254_740_991,
		max: 9_007_199_254_740_991,
	},
	horses: { type: Map, of: Number, default: {} },
	lastHorse: { type: String, default: undefined },
	lastBeg: { type: Date },
	begStreak: { type: Number, default: 0 },
});
// eslint-disable-next-line @typescript-eslint/naming-convention
export const UserHorses = mongoose.model(
	"UserHorses",
	userHorsesSchema,
);

const settingsSchema = new mongoose.Schema<ISettings>({
	userId: { type: String, required: true, unique: true },
	horsesOptIn: { type: Boolean, default: true },
	horsesSpawnPing: {
		type: String,
		enum: Object.values(horsesSpawnPingSetting),
		default: horsesSpawnPingSetting.Never,
	},
});
// eslint-disable-next-line @typescript-eslint/naming-convention
export const Settings = mongoose.model("Settings", settingsSchema);

// eslint-disable-next-line @typescript-eslint/naming-convention
export const MessageCache = mongoose.model(
	"MessageCache",
	new mongoose.Schema<IMessageCache>({
		userId: String,
		guildId: String,
		lastMessageTime: { type: Number, default: 0 },
		recentMessages: { type: [String], default: [] },
	}),
);

// eslint-disable-next-line @typescript-eslint/naming-convention
export const PingResponse = mongoose.model(
	"PingResponse",
	new mongoose.Schema<IPingResponse>({
		message: { type: String, required: true },
		weight: { type: Number, required: true, default: 1, min: 0 },
		trigger: {
			type: {
				type: String,
				enum: ["contains", "author", "exact"],
				default: null,
			},
			text: { type: String, default: null },
		},
	}),
);

// eslint-disable-next-line @typescript-eslint/naming-convention
export const OrbitalScript = mongoose.model(
	"OrbitalScript",
	new mongoose.Schema<IOrbitalScript>({
		name: { type: String, default: "global", unique: true },
		code: { type: String, default: "" },
	}),
);

const trainedHorsesSchema = new mongoose.Schema<ITrainedHorses>({
	ownerId: String,
	name: String,
	breed: String,
	speed: Number,
	speedModifier: Number,
	xp: { type: Number, default: 0 },
});
// eslint-disable-next-line unicorn/no-top-level-side-effects
trainedHorsesSchema.index({ ownerId: 1 });
// eslint-disable-next-line @typescript-eslint/naming-convention
export const TrainedHorses = mongoose.model(
	"TrainedHorses",
	trainedHorsesSchema,
);

const gamblingStatsSubSchema =
	new mongoose.Schema<IGamblingUserStats>(
		{
			wins: { type: Number, default: 0, min: 0 },
			losses: { type: Number, default: 0, min: 0 },
			highestWin: { type: Number, default: 0, min: 0 },
			highestLoss: { type: Number, default: 0, max: 0 },
			highestGamblingStreak: {
				type: Number,
				default: 0,
				min: 0,
			},
			totalDollarsGambled: { type: Number, default: 0, min: 0 },
			totalDollarsWon: { type: Number, default: 0, min: 0 },
			totalDollarsLost: { type: Number, default: 0, max: 0 },
			totalCoinsGambled: { type: Number, default: 0, min: 0 },
			totalCoinsWon: { type: Number, default: 0, min: 0 },
			totalCoinsLost: { type: Number, default: 0, max: 0 },
		},
		{ _id: false },
	);

const spawnStatsSubSchema = new mongoose.Schema<ISpawnUserStats>(
	{
		totalSpawns: { type: Number, default: 0, min: 0 },
		totalSpawnsValue: { type: Number, default: 0, min: 0 },
		highestValueSpawn: { type: Number, default: 0, min: 0 },
		messagesCounted: { type: Number, default: 0, min: 0 },
	},
	{ _id: false },
);

const begStatsSubSchema = new mongoose.Schema<IBegUserStats>(
	{
		begs: { type: Number, default: 0, min: 0 },
	},
	{ _id: false },
);

const donationStatsSubSchema =
	new mongoose.Schema<IDonationUserStats>(
		{
			totalGiven: { type: Number, default: 0, min: 0 },
			totalRecieved: { type: Number, default: 0, min: 0 },
			highestGiven: { type: Number, default: 0, min: 0 },
			highestRecieved: { type: Number, default: 0, min: 0 },
		},
		{ _id: false },
	);

const leaderboardStatsSubSchema =
	new mongoose.Schema<ILeaderboardUserStats>(
		{
			highestPosition: {
				type: [Number, null],
				default: null,
				validate: {
					validator(value: unknown) {
						return value === null || value === undefined
							? true
							: typeof value === "number" && value >= 1;
					},
					message:
						"highestPosition must be a number greater than or equal to 1, or null.",
				},
			},
		},
		{ _id: false },
	);

const racesStatsSubSchema = new mongoose.Schema<IRacesUserStats>(
	{
		racesWon: { type: Number, default: 0, min: 0 },
		racesLost: { type: Number, default: 0, min: 0 },
	},
	{ _id: false },
);

const tradeStatsSubSchema = new mongoose.Schema<ITradeUserStats>(
	{
		tradesCompleted: { type: Number, default: 0, min: 0 },
		totalDollarsGiven: { type: Number, default: 0, min: 0 },
		totalDollarsRecieved: { type: Number, default: 0, min: 0 },
		totalCoinsGiven: { type: Number, default: 0, min: 0 },
		totalCoinsRecieved: { type: Number, default: 0, min: 0 },
	},
	{ _id: false },
);

const timeframeSubSchema = new mongoose.Schema<ITimeframeStats>(
	{
		gambling: {
			type: gamblingStatsSubSchema,
			default: () => ({}),
		},
		spawns: { type: spawnStatsSubSchema, default: () => ({}) },
		begs: { type: begStatsSubSchema, default: () => ({}) },
		donations: {
			type: donationStatsSubSchema,
			default: () => ({}),
		},
		leaderboard: {
			type: leaderboardStatsSubSchema,
			default: () => ({}),
		},
		races: { type: racesStatsSubSchema, default: () => ({}) },
		trades: { type: tradeStatsSubSchema, default: () => ({}) },
		nextRefresh: { type: Date, required: true },
	},
	{ _id: false },
);
// eslint-disable-next-line unicorn/no-top-level-side-effects
timeframeSubSchema.virtual("nextRefreshTemporal").get(function (
	this: ITimeframeStats,
) {
	return Temporal.Instant.fromEpochMilliseconds(
		this.nextRefresh.getTime(),
	);
});

const allTimeSubSchema = new mongoose.Schema<
	Omit<ITimeframeStats, "nextRefresh" | "nextRefreshTemporal">
>(
	{
		gambling: {
			type: gamblingStatsSubSchema,
			default: () => ({}),
		},
		spawns: { type: spawnStatsSubSchema, default: () => ({}) },
		begs: { type: begStatsSubSchema, default: () => ({}) },
		donations: {
			type: donationStatsSubSchema,
			default: () => ({}),
		},
		leaderboard: {
			type: leaderboardStatsSubSchema,
			default: () => ({}),
		},
		races: { type: racesStatsSubSchema, default: () => ({}) },
		trades: { type: tradeStatsSubSchema, default: () => ({}) },
	},
	{ _id: false },
);

const userStatsSchema = new mongoose.Schema<IUserStats>({
	userId: { type: String, required: true, unique: true },
	daily: { type: timeframeSubSchema, default: () => ({}) },
	weekly: { type: timeframeSubSchema, default: () => ({}) },
	allTime: { type: allTimeSubSchema, default: () => ({}) },
});
// eslint-disable-next-line unicorn/no-top-level-side-effects
userStatsSchema.index({ userId: 1 });

// eslint-disable-next-line @typescript-eslint/naming-convention
export const UserStats = mongoose.model("UserStats", userStatsSchema);

const timeframeQuestsSchema = new mongoose.Schema<ITimeframeQuests>(
	{
		claimed: { type: [String], default: [] },
		unclaimed: { type: [String], default: [] },
		nextRefresh: { type: Date, required: true },
		rerollsUsed: { type: Number, default: 0 },
	},
	{ _id: false },
);
// eslint-disable-next-line unicorn/no-top-level-side-effects
timeframeQuestsSchema.virtual("nextRefreshTemporal").get(function (
	this: ITimeframeQuests,
) {
	return Temporal.Instant.fromEpochMilliseconds(
		this.nextRefresh.getTime(),
	);
});

const userQuestsSchema = new mongoose.Schema<IUserQuests>({
	userId: { type: String, required: true, unique: true },
	daily: { type: timeframeQuestsSchema, default: () => ({}) },
	weekly: { type: timeframeQuestsSchema, default: () => ({}) },
});

// eslint-disable-next-line @typescript-eslint/naming-convention
export const UserQuests = mongoose.model(
	"UserQuests",
	userQuestsSchema,
);

// Ensure indexes are created in MongoDB
/* yeah no we dont need this
try {
	await Promise.all([
		Rule.collection.createIndex({ watchUser: 1 }),
		Rule.collection.createIndex({ channel: 1 }),
		Rule.collection.createIndex({ watchUser: 1, channel: 1 }),
		Timeout.collection.createIndex({ revertAt: 1 }),
		ModChannel.collection.createIndex({ guildId: 1 }),
		UserHorses.collection.createIndex({ userId: 1 }),
		TrainedHorses.collection.createIndex({ ownerId: 1 }),
	]);
} catch (error: unknown) {
	console.error("Index creation error:", error);
} */
