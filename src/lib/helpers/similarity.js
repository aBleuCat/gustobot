// Dice bigram coefficient
function stringSimilarity(a, b) {
	if (a === b) return 1;
	if (a.length < 2 || b.length < 2) return 0;

	const getBigrams = (string_) => {
		const bigrams = new Set();
		for (let i = 0; i < string_.length - 1; i++)
			bigrams.add(string_.slice(i, i + 2));
		return bigrams;
	};

	const aB = getBigrams(a.toLowerCase());
	const bB = getBigrams(b.toLowerCase());
	const intersection = [...aB].filter((x) => bB.has(x)).length;
	return (2 * intersection) / (aB.size + bB.size);
}

module.exports = {stringSimilarity};
