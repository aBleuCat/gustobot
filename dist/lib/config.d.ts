interface ConfigType {
    DEBOUNCE_MS: number;
    SIMILARITY_THRESHOLD: number;
    RECENT_MSG_COUNT: number;
    COIN_CHANCE: number;
    SPAWN_COEFFICIENT: number;
    FLAIR_THRESHOLD_VALUE: number;
    COIN_DROP_SIZE: number;
    COIN_DROP_MIN: number;
    COIN_DROP_MAX: number;
    ANTIINFLATOR: number;
    UNEXPECTED_CAT_PROBABILITY: number;
    MIN_CYCLE_COIN_COUNT: number;
    FRENZY_THRESHOLD_MS: number;
    FRENZY_CHANCE: number;
    CONFISCATE_CHANCE: number;
    LOSS_THRESHOLD: number;
    PROGRESSIVE_COIN_GAMBLE_TAX: number;
    MAX_ROLL: number;
    MIN_ROLL: number;
    MESSAGE_CACHE_CLEANUP_MS: number;
    DEV_GUILD_ID: string;
    DEV_LOG_CHANNEL_ID: string;
    BG_TASKS_CHANNEL_ID: string;
    MICRO_LOG_CHANNEL_ID: string;
    STATUS_LOG_CHANNEL: string;
    COMMON_BUY_PRICE: number;
    COMMON_SELL_PRICE: number;
    RULE_CACHE_TTL_MS: number;
    lists: {
        primaryTrigBlacklist: string[];
        primaryTrigWhitelist: string[];
        secondaryTrigBlacklist: string[];
        secondaryTrigWhitelist: string[];
    };
}
export declare const config: ConfigType;
interface DescriptionsType {
    [key: string]: string;
    lists: string;
}
export declare const descriptions: DescriptionsType;
export {};
//# sourceMappingURL=config.d.ts.map