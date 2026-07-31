import {
	EmbedBuilder,
	MessageFlags,
	type ChatInputCommandInteraction,
} from "discord.js";
import { config, immutConfig } from "../../lib/config.js";

export { config, descriptions } from "../../lib/config.js";

export type ConfigKey = keyof typeof config;
export type NumericConfigKey = {
	[K in ConfigKey]: (typeof config)[K] extends number ? K : never;
}[ConfigKey];
export type ConfigListKey = Exclude<keyof typeof config.lists, "botAdmins">;

export const adminIds = immutConfig.ADMINS;

export const isConfigKey = (key: string): key is ConfigKey =>
	Object.hasOwn(config, key);

export const isNumericConfigKey = (key: string): key is NumericConfigKey =>
	isConfigKey(key) && typeof config[key] === "number";

export const isConfigListKey = (key: string): key is ConfigListKey =>
	Object.hasOwn(config.lists, key) && key !== "botAdmins";

export const isListAction = (
	value: string,
): value is "add" | "remove" | "view" =>
	["add", "remove", "view"].includes(value);

export const renderConfigValue = (value: unknown): string =>
	typeof value === "object" && value !== null
		? JSON.stringify(value)
		: String(value);

export const sendConfigChunks = async (
	interaction: ChatInputCommandInteraction,
	items: string[],
) => {
	const chunks: string[] = [];
	let currentChunk = "";
	for (const item of items) {
		if (
			(currentChunk + "\n" + item).length >
			immutConfig.DISCORD_MSG_SAFE_CHAR_LIMIT
		) {
			chunks.push(currentChunk);
			currentChunk = item;
		} else {
			currentChunk += (currentChunk ? "\n" : "") + item;
		}
	}

	if (currentChunk) {
		chunks.push(currentChunk);
	}

	for (let i = 0; i < chunks.length; i++) {
		const embed = new EmbedBuilder()
			.setColor("#0099ff")
			.setTitle(`Runtime Config (${i + 1}/${chunks.length})`)
			.setDescription(chunks[i]!);

		if (i === 0) {
			// eslint-disable-next-line no-await-in-loop
			await interaction.reply({
				embeds: [embed],
				flags: [MessageFlags.Ephemeral],
			});
		} else {
			// eslint-disable-next-line no-await-in-loop
			await interaction.followUp({
				embeds: [embed],
				flags: [MessageFlags.Ephemeral],
			});
		}
	}
};

