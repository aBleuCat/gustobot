import {
	SlashCommandSubcommandBuilder,
	type ChatInputCommandInteraction,
	MessageFlags,
	AttachmentBuilder,
} from "discord.js";
import mongoose from "mongoose";
import type { IUserHorses, ITrainedHorses } from "../../lib/models.js";
import rawHorseValues from "../../data/horses.json" with { type: "json" };
import { castAsHorseData } from "../../type-utils.js";
import { config } from "../../lib/config.js";
import {
	horseName,
	conditionHorse,
} from "../../lib/helpers/horse-funcs.js";

const HORSE_VALUES = castAsHorseData(rawHorseValues);

// Shared by leaderboardStats and buildHorseInvList so the two never drift apart.
function trainedHorseValue(breed: string): number {
	const base = HORSE_VALUES[breed]?.value ?? 0;
	const trainedBonus =
		Math.floor(base / config.TRAINING_PRICE_DIVISOR) +
		config.TRAINING_PRICE_CONSTANT;
	return base + trainedBonus / 2;
}

export const data = new SlashCommandSubcommandBuilder()
	.setName("collection")
	.setDescription("View a collection of horses")
	.addUserOption((option) =>
		option
			.setName("user")
			.setDescription(
				"The user whose collection you want to view",
			)
			.setRequired(false),
	)
	.addBooleanOption((option) =>
		option
			.setName("ephemeral")
			.setDescription(
				"Whether to show the collection ephemeral or publicly in the channel (defaults to ephemeral)",
			),
	);

function leaderboardStats(
	allUsers: IUserHorses[],
	trainedMap: Map<string, ITrainedHorses[]>,
	targetUserId: string,
) {
	const leaderboard = allUsers
		.map((u) => {
			let worth = 0;
			for (const [slug, count] of u.horses) {
				worth += (HORSE_VALUES[slug]?.value ?? 0) * count;
			}

			const trained = trainedMap.get(u.userId) ?? [];
			for (const t of trained) {
				worth += trainedHorseValue(t.breed);
			}

			return { userId: u.userId, worth };
		})
		.toSorted((a, b) => b.worth - a.worth);

	const rank =
		leaderboard.findIndex((u) => u.userId === targetUserId) + 1;
	const userWorth =
		leaderboard.find((u) => u.userId === targetUserId)?.worth ??
		0;

	return { rank, userWorth };
}

function buildHorseInvList(inventory: IUserHorses | undefined, trainedForUser: ITrainedHorses[] = []) {
	let compHorseText = "";
	let nonCompHorseText = "";
	let ownedUniqueCount = 0;
	const ownedSlugs = new Set<string>();

	if (inventory) {
		for (const [slug, count] of inventory.horses) {
			const horse = HORSE_VALUES[slug];
			if (count <= 0 || !horse) {
				continue;
			}

			const { value } = horse;
			const display = horseName(slug);
			const isComp = horse.comp !== false;
			const prefix = slug === "dung_beetle" ? "🪲" : "🐎";

			if (isComp) {
				compHorseText += `* ${prefix} **${display}**: \`x${count}\` — ($${value.toLocaleString()})\n`;
				ownedSlugs.add(slug);
				ownedUniqueCount++;
			} else {
				// If comp:false, show if owned, counts to wealth but not completion
				nonCompHorseText += `* 👻 **${display}**: \`x${count}\` — ($${value.toLocaleString()})\n`;
			}
		}
	}

	// Trained horses section (separate display). They also count toward completion if their breed
	// is completion-eligible and not already owned.
	let trainedHorseText = "";
	for (const t of trainedForUser) {
		const { breed } = t;
		const trainedValue = trainedHorseValue(breed);
		const displayName = t.name ?? horseName(breed);
		trainedHorseText += `* 🏅 **${displayName}** (${horseName(breed)}): ($${Math.round(trainedValue).toLocaleString()})\n`;
		if (!ownedSlugs.has(breed) && HORSE_VALUES[breed]?.comp !== false) {
			ownedSlugs.add(breed);
			ownedUniqueCount++;
		}
	}

	const horseListText =
		compHorseText +
		(nonCompHorseText
			? `\n### 👻 Specials and Secrets\n${nonCompHorseText}`
			: "") +
		(trainedHorseText ? `\n### 🏅 Trained Horses\n${trainedHorseText}` : "");

	return { horseListText, ownedUniqueCount, ownedSlugs };
}

function buildMissingList(
	allPossibleSlugs: string[],
	ownedSlugs: Set<string>,
	isSelf: boolean,
	username: string,
) {
	const missing = allPossibleSlugs.filter(
		(slug) => !ownedSlugs.has(slug),
	);
	const missingHeader = isSelf
		? "### Missing Thingamabobs"
		: `### Missing from ${username}'s Stable`;
	let missingText: string;
	if (missing.length > 0) {
		missingText =
			`\n${missingHeader}\n` +
			missing
				.map((slug) => {
					const mValue = HORSE_VALUES[slug]?.value ?? 0;
					return `* *${horseName(slug)}* ($${mValue.toLocaleString()})`;
				})
				.join("\n");
	} else {
		missingText = isSelf
			? "\n### ✨ You have mastered the gustovian stables! ✨"
			: `\n### ✨ ${username} has mastered the stables! ✨`;
	}

	return missingText;
}

export async function execute(
	interaction: ChatInputCommandInteraction,
) {
	const isEphemeral =
		interaction.options.getBoolean("ephemeral") ?? true;
	await interaction.deferReply({
		flags: isEphemeral ? [MessageFlags.Ephemeral] : [],
	});
	const targetUser =
		interaction.options.getUser("user") ?? interaction.user;
	const isSelf = targetUser.id === interaction.user.id;

	const allUsers = await mongoose
		.model<IUserHorses>("UserHorses")
		.find();
	const inventory = allUsers.find(
		(u) => u.userId === targetUser.id,
	);

	// Fetch trained horses and group by ownerId so we can factor them into worth and completion
	const allTrained = await mongoose.model<ITrainedHorses>("TrainedHorses").find();
	const trainedMap = new Map<string, ITrainedHorses[]>();
	for (const t of allTrained) {
		const array = trainedMap.get(t.ownerId) ?? [];
		array.push(t);
		trainedMap.set(t.ownerId, array);
	}

	const targetTrained = trainedMap.get(targetUser.id) ?? [];

	if (
		(!inventory?.horses ||
			[...inventory.horses.values()].every((v) => v === 0)) &&
		targetTrained.length === 0
	) {
		return interaction.editReply({
			content: isSelf
				? "Your stables are empty. Keep talking to find some horses!"
				: `${targetUser.username}'s stables are empty.`,
		});
	}

	const allPossibleSlugs = Object.keys(HORSE_VALUES).filter(
		(k) => HORSE_VALUES[k]?.comp !== false,
	);

	const { rank, userWorth } = leaderboardStats(
		allUsers,
		trainedMap,
		targetUser.id,
	);
	const { horseListText, ownedUniqueCount, ownedSlugs } =
		buildHorseInvList(inventory, targetTrained);
	const completionPercentage = Math.round(
		(ownedUniqueCount / allPossibleSlugs.length) * 100,
	);
	const missingText = buildMissingList(
		allPossibleSlugs,
		ownedSlugs,
		isSelf,
		targetUser.username,
	);

	const title = isSelf
		? "## 🐎 Your Collection 🐎"
		: `## 🐎 ${targetUser.username}'s Collection 🐎`;
	const summary = `${title}\n**Rank:** #${rank} | **Net Worth:** $${userWorth.toLocaleString()}\n**Completion:** ${completionPercentage}%\n`;
	const message = `${summary}${horseListText}${missingText}`;

	const DISCORD_MESSAGE_LIMIT = 2000;
	if (message.length > DISCORD_MESSAGE_LIMIT) {
		// Collection is too large for a single message; keep the summary inline
		// and attach the full list as a text file instead of truncating it.
		const attachment = new AttachmentBuilder(
			Buffer.from(`${horseListText}${missingText}`, "utf-8"),
			{ name: `${targetUser.username}-collection.md` },
		);
		await interaction.editReply({
			content: `${summary}\n*Your collection is too large to display inline — see the attached file.*`,
			files: [attachment],
		});
	} else {
		await interaction.editReply(message);
	}

	// Run after reply so it never blocks the interaction response
	if (inventory) {
		conditionHorse(inventory, { interaction }).catch(
			(error: unknown) => {
				console.error("conditionHorse error:", error);
			},
		);
	}
}
