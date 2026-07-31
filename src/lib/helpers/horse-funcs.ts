import type {
	GuildTextBasedChannel,
	ChatInputCommandInteraction,
} from "discord.js";
import type { IUserHorses } from "../models.js";
import rawHorseValues from "../../data/horses.json" with { type: "json" };
import { castAsHorseData } from "../../type-utils.js";

const HORSE_VALUES = castAsHorseData(rawHorseValues);

type ConditionHorseOptions =
	| {
			channel: GuildTextBasedChannel;
			interaction?: ChatInputCommandInteraction;
	  }
	| {
			interaction: ChatInputCommandInteraction;
			channel?: GuildTextBasedChannel;
	  };

export function horseName(slug: string | undefined): string {
	if (slug === undefined) return "";
	return HORSE_VALUES[slug]?.name ?? slug;
}

async function checkForEqualitySpawn(
	user: IUserHorses,
	options: ConditionHorseOptions,
): Promise<boolean> {
	// Checks if user has brightness and darkness; if so, spawns equality
	const hasLight =
		(user.horses.get("brightness_prosperity") ?? 0) > 0;
	const hasDark = (user.horses.get("darkness_despair") ?? 0) > 0;
	const hasEqual =
		(user.horses.get("equality_parallelism") ?? 0) > 0;
	if (!(hasLight && hasDark) || hasEqual) return false;
	const [lightName, darkName, equalName] = [
		"brightness_prosperity",
		"darkness_despair",
		"equality_parallelism",
	].map((slug) => horseName(slug));

	user.horses.set("equality_parallelism", 1);
	user.markModified("horses");
	const successMessage = `<@${user.userId}> woah the **${lightName}** and the **${darkName}** have spawned a **${equalName}**`;
	const { channel, interaction } = options;
	if (interaction) {
		const messageType =
			interaction.deferred || interaction.replied
				? "followUp"
				: "reply";
		await interaction[messageType]({
			content: successMessage,
		}).catch(() => undefined);
	} else if (channel) {
		await channel.send(successMessage).catch(() => undefined);
	}

	return true;
}

export async function conditionHorse(
	user: IUserHorses,
	options: ConditionHorseOptions,
) {
	const isEqualityModified = await checkForEqualitySpawn(
		user,
		options,
	);
	if (isEqualityModified) await user.save();
}
