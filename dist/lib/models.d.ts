import { Document, Model } from 'mongoose';
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
export declare const Rule: Model<IRule>;
export declare const ActionResponse: Model<IActionResponse>;
export declare const Advice: Model<IAdvice>;
export declare const AdviceBan: Model<IAdviceBan>;
export declare const Timeout: Model<ITimeout>;
export declare const ModChannel: Model<IModChannel>;
export declare const MutedChannel: Model<IMutedChannel>;
export declare const LolStats: Model<ILolStats>;
export declare const HorseConfig: Model<IHorseConfig>;
export declare const UserHorses: Model<IUserHorses>;
export declare const MessageCache: Model<IMessageCache>;
export declare const PingResponse: Model<IPingResponse>;
export declare const OrbitalScript: Model<IOrbitalScript>;
//# sourceMappingURL=models.d.ts.map