import { EmbedBuilder, type APIEmbedField } from "discord.js";

/**
 * Converts a dictionary object into a Discord Embed with fields.
 * @param title The title of the embed.
 * @param dict The key-value data.
 * @param style The style of the embed. Inline: The fields are side by side. Leaderboard: The names are on the left side, the values are on the right side.
 * @param sortFn Function that is provided for the .sort() callback. The dictionary is converted to an array and sorted before use.
 *
 */
function dictToEmbed<T>(
	title: string,
	dict: Record<string, T>,
	style:
		| "normal"
		| "inline"
		| "leaderboard"
		| "headerless leaderboard" = "normal",
	sortFn?: (a: [string, T], b: [string, T]) => number,
): EmbedBuilder {
	const dictArray = Object.entries(dict);
	if (sortFn) dictArray.sort(sortFn);
	let fields: APIEmbedField[] = [];
	if (
		style === "leaderboard" ||
		style === "headerless leaderboard"
	) {
		const players = dictArray.map(([key]) => key).join("\n");
		const scores = dictArray
			.map(([, value]) => String(value))
			.join("\n");
		fields = [
			{
				name: style === "leaderboard" ? "Player" : "\u200B",
				value: players || "none",
				inline: true,
			},
			{
				name: style === "leaderboard" ? "Score" : "\u200B",
				value: scores || "-",
				inline: true,
			},
		];
	} else {
		const inline = style === "inline";
		fields = dictArray.slice(0, 25).map(([key, value]) => {
			return {
				name: key,
				value: String(value) || "\u200B", // Prevent empty string errors
				inline,
			};
		});
	}

	const embed = new EmbedBuilder()
		.setTitle(title)
		.addFields(fields);

	return embed;
}

export default dictToEmbed;
