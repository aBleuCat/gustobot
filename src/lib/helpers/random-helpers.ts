/**
 Pull a random item from any mutable or readonly array
 @returns Returns a randomly selected element, or undefined (usually when the array is empty or sparse)
 */
export const randItem = <T>(
	array: T[] | readonly T[],
): T | undefined => array[Math.floor(Math.random() * array.length)];

/**
 Generate an integer between inclusive bounds
 @param min The lower bound of the range to generate a number from, **inclusive**
 @param max The upper bound of the range to generate a number from, **inclusive**
 @returns A pseudorandom integer from the range bounded by `min` and `max`
 */
export function randInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randSample<T>(array: T[], sampleSize: number): T[] {
	// Copy the array so we don't mutate the original
	const shuffled = [...array];

	// Clamp the sample size to the array's length
	const size = Math.min(sampleSize, shuffled.length);

	// Shuffle using Fisher-Yates algorithm
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		// eslint-disable-next-line unicorn/no-unreadable-array-destructuring
		[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
	}

	// Return the first 'size' elements
	return shuffled.slice(0, size);
}

/**
Returns a pseudorandom number based on a seed.
@param seed Any value used to seed the generator.
@returns A number between 0 (inclusive) and 1 (exclusive).
 */
export function seededRandom(seed: unknown) {
	let h = 2_166_136_261;

	/* eslint-disable no-bitwise -- Bitwise operations provide 32-bit hash mixing. */
	for (const character of String(seed)) {
		const codePoint = character.codePointAt(0);
		if (codePoint !== undefined) h ^= codePoint;
		h = Math.imul(h, 16_777_619);
	}

	h += h << 13;
	h ^= h >>> 7;
	h += h << 3;
	h ^= h >>> 17;
	h += h << 5;

	return (h >>> 0) / 4_294_967_296;
	/* eslint-enable no-bitwise */
}

/**
 Uses roulette wheel algorithm to select a random item from a list based on weights
 @param items The array of items to choose from
 @param weightFn Callback function to determine the weight of each item
 @returns The item, or undefined if the list is empty
 */
export function weightedRandom<T>(
	items: T[],
	weightFn: (item: T) => number,
): T | undefined {
	if (items.length === 0) return undefined;

	const totalWeight = items.reduce(
		(sum, item) => sum + weightFn(item),
		0,
	);

	if (totalWeight <= 0) return undefined;

	let randomValue = Math.random() * totalWeight;

	for (const item of items) {
		const weight = weightFn(item);
		if (!(weight > 0)) {
			continue;
		}

		if (randomValue < weight) {
			return item;
		}

		randomValue -= weight;
	}

	// Fallback to the last item in case of rounding errors
	return items.at(-1);
}
