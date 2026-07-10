// Dice bigram coefficient
function stringSimilarity(a: string, b: string): number {
	if (a === b) return 1;
	if (a.length < 2 || b.length < 2) return 0;

	const getBigrams = (string: string) => {
		const bigrams = new Set();
		for (let i = 0; i < string.length - 1; i++)
			{bigrams.add(string.slice(i, i + 2));}

		return bigrams;
	};

	const aB = getBigrams(a.toLowerCase());
	const bB = getBigrams(b.toLowerCase());
	const intersection = [...aB].filter((x) => bB.has(x)).length;
	return (2 * intersection) / (aB.size + bB.size);
}

export default stringSimilarity;
