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
} & mongoose.Document;
export type IMessageCache = {
	userId: string;
	guildId: string;
	lastMessageTime: number;
	recentMessages: string[];
} & mongoose.Document;
export type IPingResponse = {
	message: string;
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

const ruleSchema = new mongoose.Schema<IRule>({
	ruleId: String,
	watchUser: String,
	targetUser: String,
	channel: String,
	addRole: String,
	restoreRole: String,
	durationMs: Number,
});
ruleSchema.index({ watchUser: 1 });
ruleSchema.index({ channel: 1 });
ruleSchema.index({ watchUser: 1, channel: 1 });
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
timeoutSchema.index({ revertAt: 1 });
// eslint-disable-next-line @typescript-eslint/naming-convention
export const Timeout = mongoose.model("Timeout", timeoutSchema);

const modChannelSchema = new mongoose.Schema<IModChannel>({
	guildId: String,
	channelId: String,
});
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
	userId: String,
	lastGamble: { type: Number, default: 0 },
	horseCoins: {
		type: Number,
		default: 0,
		min: -9_007_199_254_740_991,
		max: 9_007_199_254_740_991,
	},
	horses: { type: Map, of: Number, default: {} },
});
userHorsesSchema.index({ userId: 1 });
// eslint-disable-next-line @typescript-eslint/naming-convention
export const UserHorses = mongoose.model(
	"UserHorses",
	userHorsesSchema,
);

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

// Ensure indexes are created in MongoDB
try {
	await Promise.all([
		Rule.collection.createIndex({ watchUser: 1 }),
		Rule.collection.createIndex({ channel: 1 }),
		Rule.collection.createIndex({ watchUser: 1, channel: 1 }),
		Timeout.collection.createIndex({ revertAt: 1 }),
		ModChannel.collection.createIndex({ guildId: 1 }),
		UserHorses.collection.createIndex({ userId: 1 }),
	]);
} catch (error: unknown) {
	console.error("Index creation error:", error);
}
