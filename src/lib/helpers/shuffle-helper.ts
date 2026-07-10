/**
 * Fisher-yates shuffle algorithm
 * @param array An array of any item. Should not be a sparse array.
 * @param startAt Index where the shuffling should start at. Can be a positive or negative integer. Items before the shuffle index can be shuffled, but only the items after startIndex are guaranteed to be shuffled.
 */
const shuffle = <T>(array: T[], startAt = 0): T[] => {
	const shuffled = [...array];
	const n = shuffled.length;

	const startIndex =
		startAt < 0 ? Math.max(0, n + startAt) : startAt;

	for (let i = startIndex; i < n; i++) {
		const j = Math.floor(Math.random() * (i + 1));

		// Swap
		[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
	}

	return shuffled;
};

export default shuffle;
