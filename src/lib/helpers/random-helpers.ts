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
