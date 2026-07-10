/**
 Pull a random item from any mutable or readonly array
 @returns Returns a randomly selected element, or undefined (usually when the array is empty or sparse)
 */
export const randItem = <T>(
	array: T[] | readonly T[],
): T | undefined => array[Math.floor(Math.random() * array.length)];
