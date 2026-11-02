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
