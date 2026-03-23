const mongoose = require('mongoose');

const Rule = mongoose.model('Rule', new mongoose.Schema({
    ruleId: String,
    watchUser: String,
    targetUser: String,
    channel: String,
    addRole: String,
    restoreRole: String,
    durationMs: Number
}));

const ActionResponse = mongoose.model('ActionResponse', new mongoose.Schema({
    trigger: String,
    response: String
}));

const Advice = mongoose.model('Advice', new mongoose.Schema({
    content: String,
    authorId: String
}));

const AdviceBan = mongoose.model('AdviceBan', new mongoose.Schema({
    userId: String
}));

const Timeout = mongoose.model('Timeout', new mongoose.Schema({
    targetUser: String,
    addRole: String,
    restoreRole: String,
    revertAt: Number
}));

const ModChannel = mongoose.model('ModChannel', new mongoose.Schema({
    guildId: String,
    channelId: String
}));

const MutedChannel = mongoose.model('MutedChannel', new mongoose.Schema({
    channelId: String
}));

const LolStats = mongoose.model('LolStats', new mongoose.Schema({
    id: { type: String, default: "global_stats" },
    allTime: { type: Number, default: 0 },
    weekly: { type: Number, default: 0 },
    daily: { type: Number, default: 0 },
    lastTimestamp: { type: Number, default: 0 },
    lastDay: { type: String, default: "" },
    lastWeek: { type: Number, default: 0 }
}));

const HorseConfig = mongoose.model('HorseConfig', new mongoose.Schema({
    guildId: String,
    enabled: Boolean,
    channelId: String
}));

const UserHorses = mongoose.model('UserHorses', new mongoose.Schema({
    userId: String,
    lastGamble: { type: Number, default: 0 },
    horseCoins: { type: Number, default: 0, min: -9007199254740991, max: 9007199254740991 },
    horses: { type: Map, of: Number, default: {} }
}));

const MessageCache = mongoose.model('MessageCache', new mongoose.Schema({
    userId: String,
    guildId: String,
    lastMessageTime: { type: Number, default: 0 },
    recentMessages: { type: [String], default: [] }
}));

const PingResponse = mongoose.model('PingResponse', new mongoose.Schema({
    message: { type: String, required: true },
    trigger: {
        type: { type: String, enum: ['contains', 'author', 'exact'], default: null },
        text: { type: String, default: null }
    }
}));

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
    PingResponse
};
