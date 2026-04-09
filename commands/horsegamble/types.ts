export interface HorseData {
    name: string;
    value: number;
    comp?: boolean;
    getByGamble?: boolean;
}

export interface HorseValues {
    [slug: string]: HorseData;
}

export interface VirtualInventory {
    horses: Map<string, number>;
    horseCoins: number;
}

export interface BulkPassResult {
    wins: number;
    losses: number;
    completeLosses: number;
    noChange: number;
    netValueChange: number;
    coinsSpent: number;
    gained: Map<string, number>;
    cycleOutput: Map<string, number>;
}

export interface StreakResult {
    newStreak: number;
    awarded: boolean;
}

export interface StreakMap {
    [userId: string]: number;
}