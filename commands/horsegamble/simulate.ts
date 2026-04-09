import { BulkPassResult, VirtualInventory, HorseValues } from './types';
import { ROLL_FACTOR, MIN_ROLL } from './constants';
import { getClosestHorse, horseName } from './inventory';

import horsesRaw from '../../horses.json';
const HORSE_VALUES: Record<string, any> = horsesRaw;
import { config } from '../../lib/config';

/**
 * Simulate one bulk gamble pass over an array of slugs.
 * Mutates virtualInv in place. Does NOT touch the DB.
 */
export function simulateBulkPass(
    slugsToGamble: string[],
    virtualInv: VirtualInventory,
    costPerHorse: number,
): BulkPassResult {
    let wins = 0, losses = 0, completeLosses = 0, noChange = 0;
    let netValueChange = 0, coinsSpent = 0;
    const gained = new Map<string, number>();
    const cycleOutput = new Map<string, number>();

    for (const slug of slugsToGamble) {
        if ((virtualInv.horses.get(slug) || 0) <= 0) continue;

        virtualInv.horseCoins -= costPerHorse;
        coinsSpent += costPerHorse;

        if (virtualInv.horseCoins < 0 && Math.random() < config.CONFISCATE_CHANCE) {
            virtualInv.horses.set(slug, virtualInv.horses.get(slug)! - 1);
            completeLosses++;
            continue;
        }

        const startValue = HORSE_VALUES[slug].value;
        const change = Math.floor(Math.random() * ROLL_FACTOR) + MIN_ROLL;
        const targetValue = startValue + change;
        const effectiveLossThresh = config.LOSS_THRESHOLD - Math.max(0, (startValue - 100) / 10);

        if (change < effectiveLossThresh) {
            virtualInv.horses.set(slug, virtualInv.horses.get(slug)! - 1);
            netValueChange -= startValue;
            completeLosses++;
        } else {
            const closestSlug = getClosestHorse(targetValue);
            const endValue = HORSE_VALUES[closestSlug].value;
            const actualDiff = endValue - startValue;

            virtualInv.horses.set(slug, virtualInv.horses.get(slug)! - 1);

            if (closestSlug === slug) {
                virtualInv.horses.set(slug, (virtualInv.horses.get(slug) || 0) + 1);
                noChange++;
                cycleOutput.set(slug, (cycleOutput.get(slug) || 0) + 1);
            } else {
                virtualInv.horses.set(closestSlug, (virtualInv.horses.get(closestSlug) || 0) + 1);
                gained.set(closestSlug, (gained.get(closestSlug) || 0) + 1);
                cycleOutput.set(closestSlug, (cycleOutput.get(closestSlug) || 0) + 1);
                netValueChange += actualDiff;
                if (actualDiff >= 0) wins++;
                else losses++;
            }
        }
    }

    return { wins, losses, completeLosses, noChange, netValueChange, coinsSpent, gained, cycleOutput };
}