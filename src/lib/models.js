const mongoose = require('mongoose');

const ruleSchema = new mongoose.Schema({
	ruleId: String,
	watchUser: String,
	targetUser: String,
	channel: String,
	addRole: String,
	restoreRole: String,
	durationMs: Number,
});
ruleSchema.index({watchUser: 1});
ruleSchema.index({channel: 1});
ruleSchema.index({watchUser: 1, channel: 1});
const Rule = mongoose.model('Rule', ruleSchema);

const ActionResponse = mongoose.model(
	'ActionResponse',
	new mongoose.Schema({
		trigger: String,
		response: String,
	}),
);

const Advice = mongoose.model(
	'Advice',
	new mongoose.Schema({
		content: String,
		authorId: String,
	}),
);

const AdviceBan = mongoose.model(
	'AdviceBan',
	new mongoose.Schema({
		userId: String,
	}),
);

const timeoutSchema = new mongoose.Schema({
	guildId: String,
	targetUser: String,
	addRole: String,
	restoreRole: String,
	revertAt: Number,
});
timeoutSchema.index({revertAt: 1});
const Timeout = mongoose.model('Timeout', timeoutSchema);

const modChannelSchema = new mongoose.Schema({
	guildId: String,
	channelId: String,
});
modChannelSchema.index({guildId: 1});
const ModChannel = mongoose.model('ModChannel', modChannelSchema);

const MutedChannel = mongoose.model(
	'MutedChannel',
	new mongoose.Schema({
		channelId: String,
	}),
);

const LolStats = mongoose.model(
	'LolStats',
	new mongoose.Schema({
		id: {type: String, default: 'global_stats'},
		allTime: {type: Number, default: 0},
		weekly: {type: Number, default: 0},
		daily: {type: Number, default: 0},
		lastTimestamp: {type: Number, default: 0},
		lastDay: {type: String, default: ''},
		lastWeek: {type: Number, default: 0},
	}),
);

const HorseConfig = mongoose.model(
	'HorseConfig',
	new mongoose.Schema({
		guildId: String,
		enabled: Boolean,
		channelId: String,
	}),
);

const userHorsesSchema = new mongoose.Schema({
	userId: String,
	lastGamble: {type: Number, default: 0},
	horseCoins: {
		type: Number,
		default: 0,
		min: -9_007_199_254_740_991,
		max: 9_007_199_254_740_991,
	},
	horses: {type: Map, of: Number, default: {}},
});
userHorsesSchema.index({userId: 1});
const UserHorses = mongoose.model('UserHorses', userHorsesSchema);

const MessageCache = mongoose.model(
	'MessageCache',
	new mongoose.Schema({
		userId: String,
		guildId: String,
		lastMessageTime: {type: Number, default: 0},
		recentMessages: {type: [String], default: []},
	}),
);

const PingResponse = mongoose.model(
	'PingResponse',
	new mongoose.Schema({
		message: {type: String, required: true},
		trigger: {
			type: {
				type: String,
				enum: ['contains', 'author', 'exact'],
				default: null,
			},
			text: {type: String, default: null},
		},
	}),
);
const OrbitalScript = mongoose.model(
	'OrbitalScript',
	new mongoose.Schema({
		name: {type: String, default: 'global', unique: true},
		code: {type: String, default: ''},
	}),
);

// Ensure indexes are created in MongoDB
Promise.all([
	Rule.collection.createIndex({watchUser: 1}),
	Rule.collection.createIndex({channel: 1}),
	Rule.collection.createIndex({watchUser: 1, channel: 1}),
	Timeout.collection.createIndex({revertAt: 1}),
	ModChannel.collection.createIndex({guildId: 1}),
	UserHorses.collection.createIndex({userId: 1}),
]).catch((error) => console.error('Index creation error:', error));

module.exports = {
	Rule,
	ActionResponse,
	Advice,
	AdviceBan,
	Timeout,
	ModChannel,
	MutedChannel,
	LolStats,
	HorseConfig,
	UserHorses,
	MessageCache,
	PingResponse,
	OrbitalScript,
};
