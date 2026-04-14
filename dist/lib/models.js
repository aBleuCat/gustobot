import mongoose, { Schema } from 'mongoose';
// Schemas
const ruleSchema = new Schema({
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
export const Rule = mongoose.model('Rule', ruleSchema);
export const ActionResponse = mongoose.model('ActionResponse', new Schema({
    trigger: String,
    response: String,
}));
export const Advice = mongoose.model('Advice', new Schema({
    content: String,
    authorId: String,
}));
export const AdviceBan = mongoose.model('AdviceBan', new Schema({
    userId: String,
}));
const timeoutSchema = new Schema({
    guildId: String,
    targetUser: String,
    addRole: String,
    restoreRole: String,
    revertAt: Number,
});
timeoutSchema.index({ revertAt: 1 });
export const Timeout = mongoose.model('Timeout', timeoutSchema);
const modChannelSchema = new Schema({
    guildId: String,
    channelId: String,
});
modChannelSchema.index({ guildId: 1 });
export const ModChannel = mongoose.model('ModChannel', modChannelSchema);
export const MutedChannel = mongoose.model('MutedChannel', new Schema({
    channelId: String,
}));
export const LolStats = mongoose.model('LolStats', new Schema({
    id: { type: String, default: 'global_stats' },
    allTime: { type: Number, default: 0 },
    weekly: { type: Number, default: 0 },
    daily: { type: Number, default: 0 },
    lastTimestamp: { type: Number, default: 0 },
    lastDay: { type: String, default: '' },
    lastWeek: { type: Number, default: 0 },
}));
export const HorseConfig = mongoose.model('HorseConfig', new Schema({
    guildId: String,
    enabled: Boolean,
    channelId: String,
}));
const userHorsesSchema = new Schema({
    userId: String,
    lastGamble: { type: Number, default: 0 },
    horseCoins: { type: Number, default: 0, min: -9007199254740991, max: 9007199254740991 },
    horses: { type: Map, of: Number, default: {} },
});
userHorsesSchema.index({ userId: 1 });
export const UserHorses = mongoose.model('UserHorses', userHorsesSchema);
export const MessageCache = mongoose.model('MessageCache', new Schema({
    userId: String,
    guildId: String,
    lastMessageTime: { type: Number, default: 0 },
    recentMessages: { type: [String], default: [] },
}));
export const PingResponse = mongoose.model('PingResponse', new Schema({
    message: { type: String, required: true },
    trigger: {
        type: { type: String, enum: ['contains', 'author', 'exact'], default: null },
        text: { type: String, default: null },
    },
}));
export const OrbitalScript = mongoose.model('OrbitalScript', new Schema({
    name: { type: String, default: 'global', unique: true },
    code: { type: String, default: '' },
}));
// Ensure indexes are created in MongoDB
Promise.all([
    Rule.collection.createIndex({ watchUser: 1 }),
    Rule.collection.createIndex({ channel: 1 }),
    Rule.collection.createIndex({ watchUser: 1, channel: 1 }),
    Timeout.collection.createIndex({ revertAt: 1 }),
    ModChannel.collection.createIndex({ guildId: 1 }),
    UserHorses.collection.createIndex({ userId: 1 }),
]).catch(err => console.error('Index creation error:', err));
//# sourceMappingURL=models.js.map