import mongoose, { Schema, Document, Model } from 'mongoose';

// Type definitions
export interface IRule extends Document {
  ruleId: string;
  watchUser: string;
  targetUser: string;
  channel: string;
  addRole: string;
  restoreRole: string;
  durationMs: number;
}

export interface IActionResponse extends Document {
  trigger: string;
  response: string;
}

export interface IAdvice extends Document {
  content: string;
  authorId: string;
}

export interface IAdviceBan extends Document {
  userId: string;
}

export interface ITimeout extends Document {
  guildId: string;
  targetUser: string;
  addRole: string;
  restoreRole: string;
  revertAt: number;
}

export interface IModChannel extends Document {
  guildId: string;
  channelId: string;
}

export interface IMutedChannel extends Document {
  channelId: string;
}

export interface ILolStats extends Document {
  id: string;
  allTime: number;
  weekly: number;
  daily: number;
  lastTimestamp: number;
  lastDay: string;
  lastWeek: number;
}

export interface IHorseConfig extends Document {
  guildId: string;
  enabled: boolean;
  channelId: string;
}

export interface IUserHorses extends Document {
  userId: string;
  lastGamble: number;
  horseCoins: number;
  horses: Map<string, number>;
}

export interface IMessageCache extends Document {
  userId: string;
  guildId: string;
  lastMessageTime: number;
  recentMessages: string[];
}

export interface IPingResponseTrigger {
  type?: 'contains' | 'author' | 'exact' | null;
  text?: string | null;
}

export interface IPingResponse extends Document {
  message: string;
  trigger?: IPingResponseTrigger;
}

export interface IOrbitalScript extends Document {
  name: string;
  code: string;
}

// Schemas
const ruleSchema = new Schema<IRule>({
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

export const Rule: Model<IRule> = mongoose.model<IRule>('Rule', ruleSchema);

export const ActionResponse: Model<IActionResponse> = mongoose.model<IActionResponse>(
  'ActionResponse',
  new Schema<IActionResponse>({
    trigger: String,
    response: String,
  })
);

export const Advice: Model<IAdvice> = mongoose.model<IAdvice>(
  'Advice',
  new Schema<IAdvice>({
    content: String,
    authorId: String,
  })
);

export const AdviceBan: Model<IAdviceBan> = mongoose.model<IAdviceBan>(
  'AdviceBan',
  new Schema<IAdviceBan>({
    userId: String,
  })
);

const timeoutSchema = new Schema<ITimeout>({
  guildId: String,
  targetUser: String,
  addRole: String,
  restoreRole: String,
  revertAt: Number,
});
timeoutSchema.index({ revertAt: 1 });

export const Timeout: Model<ITimeout> = mongoose.model<ITimeout>('Timeout', timeoutSchema);

const modChannelSchema = new Schema<IModChannel>({
  guildId: String,
  channelId: String,
});
modChannelSchema.index({ guildId: 1 });

export const ModChannel: Model<IModChannel> = mongoose.model<IModChannel>('ModChannel', modChannelSchema);

export const MutedChannel: Model<IMutedChannel> = mongoose.model<IMutedChannel>(
  'MutedChannel',
  new Schema<IMutedChannel>({
    channelId: String,
  })
);

export const LolStats: Model<ILolStats> = mongoose.model<ILolStats>(
  'LolStats',
  new Schema<ILolStats>({
    id: { type: String, default: 'global_stats' },
    allTime: { type: Number, default: 0 },
    weekly: { type: Number, default: 0 },
    daily: { type: Number, default: 0 },
    lastTimestamp: { type: Number, default: 0 },
    lastDay: { type: String, default: '' },
    lastWeek: { type: Number, default: 0 },
  })
);

export const HorseConfig: Model<IHorseConfig> = mongoose.model<IHorseConfig>(
  'HorseConfig',
  new Schema<IHorseConfig>({
    guildId: String,
    enabled: Boolean,
    channelId: String,
  })
);

const userHorsesSchema = new Schema<IUserHorses>({
  userId: String,
  lastGamble: { type: Number, default: 0 },
  horseCoins: { type: Number, default: 0, min: -9007199254740991, max: 9007199254740991 },
  horses: { type: Map, of: Number, default: {} },
});
userHorsesSchema.index({ userId: 1 });

export const UserHorses: Model<IUserHorses> = mongoose.model<IUserHorses>('UserHorses', userHorsesSchema);

export const MessageCache: Model<IMessageCache> = mongoose.model<IMessageCache>(
  'MessageCache',
  new Schema<IMessageCache>({
    userId: String,
    guildId: String,
    lastMessageTime: { type: Number, default: 0 },
    recentMessages: { type: [String], default: [] },
  })
);

export const PingResponse: Model<IPingResponse> = mongoose.model<IPingResponse>(
  'PingResponse',
  new Schema<IPingResponse>({
    message: { type: String, required: true },
    trigger: {
      type: { type: String, enum: ['contains', 'author', 'exact'], default: null },
      text: { type: String, default: null },
    },
  })
);

export const OrbitalScript: Model<IOrbitalScript> = mongoose.model<IOrbitalScript>(
  'OrbitalScript',
  new Schema<IOrbitalScript>({
    name: { type: String, default: 'global', unique: true },
    code: { type: String, default: '' },
  })
);

// Ensure indexes are created in MongoDB
Promise.all([
  Rule.collection.createIndex({ watchUser: 1 }),
  Rule.collection.createIndex({ channel: 1 }),
  Rule.collection.createIndex({ watchUser: 1, channel: 1 }),
  Timeout.collection.createIndex({ revertAt: 1 }),
  ModChannel.collection.createIndex({ guildId: 1 }),
  UserHorses.collection.createIndex({ userId: 1 }),
]).catch(err => console.error('Index creation error:', err));
