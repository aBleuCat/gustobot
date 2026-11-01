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
