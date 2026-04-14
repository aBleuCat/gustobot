export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const getBigrams = (str: string): Set<string> => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.slice(i, i + 2));
    }
    return bigrams;
  };

  const aB = getBigrams(a.toLowerCase());
  const bB = getBigrams(b.toLowerCase());
  const intersection = [...aB].filter(x => bB.has(x)).length;
  return (2 * intersection) / (aB.size + bB.size);
}
