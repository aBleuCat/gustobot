import { HorseValues, VirtualInventory } from './types';

const HORSE_VALUES: HorseValues = require('../../horses.json');

export function horseName(slug: string): string {
    return HORSE_VALUES[slug]?.name ?? slug;
}

export function getClosestHorse(targetValue: number): string {
    let minDiff = Infinity;
    let candidates: string[] = [];
    for (const [slug, data] of Object.entries(HORSE_VALUES)) {
        if (data.comp === false) continue;
        if (data.getByGamble === false) continue;
        const diff = Math.abs(data.value - targetValue);
        if (diff < minDiff) { minDiff = diff; candidates = [slug]; }
        else if (diff === minDiff) { candidates.push(slug); }
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
}

export function calculateCoinCostPerHorse(coinAmount: number): number {
    const { config } = require('../../lib/config');
    return Math.max(1, Math.ceil(coinAmount / 50 * config.PROGRESSIVE_COIN_GAMBLE_TAX));
}

export function requiredHorseCoins(coinAmount: number): number {
    const { config } = require('../../lib/config');
    return Math.ceil(coinAmount / 50 * config.PROGRESSIVE_COIN_GAMBLE_TAX) || 1;
}

export function normalizeHorseMap(inventory: any): any {
    if (!inventory) return inventory;
    if (inventory.horses instanceof Map) return inventory;
    const source = inventory.horses && typeof inventory.horses === 'object' ? inventory.horses : {};
    inventory.horses = new Map(Object.entries(source));
    if (typeof inventory.markModified === 'function') inventory.markModified('horses');
    return inventory;
}

export async function getOrCreateInventory(UserHorses: any, userId: string): Promise<any> {
    let inv = await UserHorses.findOne({ userId });
    if (!inv) inv = new UserHorses({ userId, horses: new Map(), horseCoins: 0 });
    return normalizeHorseMap(inv);
}

// Returns [{slug, value, count}] sorted by value — does NOT expand by count to avoid OOM
export function getSortedHorseList(inventory: any, sortDir: 'asc' | 'desc' = 'asc'): Array<{ slug: string; value: number; count: number }> {
    const list: Array<{ slug: string; value: number; count: number }> = [];
    for (const [slug, count] of (inventory.horses as Map<string, number>).entries()) {
        if (count > 0 && HORSE_VALUES[slug]) {
            list.push({ slug, value: HORSE_VALUES[slug].value, count });
        }
    }
    list.sort((a, b) => sortDir === 'asc' ? a.value - b.value : b.value - a.value);
    return list;
}