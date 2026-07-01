import {
	EmbedBuilder,
	type APIEmbedField,
	type ColorResolvable,
} from "discord.js";

/**
 * Converts a dictionary object into a Discord Embed with fields.
 * @param title The title of the embed.
 * @param dict The key-value data
 * @param inline Whether or not the embed fields should be side-by-side (inline)
 */
function dictToEmbed(
	title: string,
	dict: Record<string, any>,
	inline = false,
	color?: ColorResolvable,
): EmbedBuilder {
	const fields: APIEmbedField[] = Object.entries(dict).map(
		([key, value]) => {
			return {
				name: key,
				value: String(value),
				inline,
			};
		},
	);

	const embed = new EmbedBuilder()
		.setTitle(title)
		.addFields(fields);
	if (color) embed.setColor(color);

	return embed;
}

export default dictToEmbed;
