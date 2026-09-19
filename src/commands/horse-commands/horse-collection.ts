import {
	SlashCommandSubcommandBuilder,
	type ChatInputCommandInteraction,
	MessageFlags,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	StringSelectMenuBuilder,
	type ButtonInteraction,
	type StringSelectMenuInteraction,
} from "discord.js";
import mongoose from "mongoose";
import type { IUserHorses, ITrainedHorses } from "../../lib/models.js";
import rawHorseValues from "../../data/horses.json" with { type: "json" };
import { castAsHorseData } from "../../type-utils.js";
import { horseName, trainedHorseValue } from "../../lib/helpers/horse-funcs.js";
import { immutConfig } from "../../lib/config.js";

const HORSE_VALUES = castAsHorseData(rawHorseValues);
const HORSES_PER_PAGE = 10;

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

type PageData = {
	title: string;
	color: `#${string}`;
	lines: string[];
	isMasteredPage?: boolean;
};

function formatOwnedHorseLine(
	slug: string,
	count: number,
	value: number,
): string {
	const display = horseName(slug);
	const prefix =
		slug === "dung_beetle"
			? "🪲"
			: slug.includes("providence")
				? "✨"
				: "🐎";
	return `${prefix} **${display}** ×${count} — $${value.toLocaleString()}`;
}

// Splits an inventory into competition-eligible and non-eligible display
// lines, and tracks which slugs the inventory alone already covers.
function categorizeOwnedHorses(inventory: IUserHorses | undefined): {
	compLines: string[];
	nonCompLines: string[];
	ownedSlugs: Set<string>;
} {
	const compLines: string[] = [];
	const nonCompLines: string[] = [];
	const ownedSlugs = new Set<string>();

	if (!inventory) {
		return { compLines, nonCompLines, ownedSlugs };
	}

	for (const [slug, count] of inventory.horses) {
		const horseData = HORSE_VALUES[slug];
		if (count <= 0 || !horseData) continue;

		const line = formatOwnedHorseLine(slug, count, horseData.value);
		if (horseData.comp === false) {
			nonCompLines.push(line);
		} else {
			compLines.push(line);
			ownedSlugs.add(slug);
		}
	}

	return { compLines, nonCompLines, ownedSlugs };
}

// Builds the trained-horse display lines and folds any newly-completed
// (comp-eligible, not already owned) breeds into ownedSlugs.
function buildTrainedLines(
	trainedForUser: ITrainedHorses[],
	ownedSlugs: Set<string>,
): string[] {
	const trainedLines: string[] = [];

	for (const t of trainedForUser) {
		const { breed } = t;
		const value = trainedHorseValue(breed);
		const displayName = t.name ?? horseName(breed);
		trainedLines.push(
			`🏅 **${displayName}** (${horseName(breed)}) — $${Math.round(value).toLocaleString()}`,
		);
		if (!ownedSlugs.has(breed) && HORSE_VALUES[breed]?.comp !== false) {
			ownedSlugs.add(breed);
		}
	}

	return trainedLines;
}

function chunk<T>(items: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		chunks.push(items.slice(i, i + size));
	}

	return chunks;
}

// Splits a flat list of lines into one PageData per HORSES_PER_PAGE lines.
// Returns [] for an empty list, so callers can spread the result directly.
function paginateLines(
	lines: string[],
	titleFor: (pageNumber: number, totalPages: number) => string,
	color: `#${string}`,
): PageData[] {
	if (lines.length === 0) return [];

	const chunks = chunk(lines, HORSES_PER_PAGE);
	return chunks.map((pageLines, i) => ({
		title: titleFor(i + 1, chunks.length),
		color,
		lines: pageLines,
	}));
}

function buildMissingPages(
	allPossibleSlugs: string[],
	ownedSlugs: Set<string>,
	isSelf: boolean,
	username: string,
): PageData[] {
	const missing = allPossibleSlugs.filter(
		(slug) => !ownedSlugs.has(slug),
	);

	if (missing.length === 0) {
		return [
			{
				title: isSelf
					? "✨ Mastered!"
					: `✨ ${username} has mastered the stables!`,
				color: "#a6e3a1",
				lines: [],
				isMasteredPage: true,
			},
		];
	}

	const missingLines = missing.map((slug) => {
		const mValue = HORSE_VALUES[slug]?.value ?? 0;
		return `*${horseName(slug)}* ($${mValue.toLocaleString()})`;
	});

	return paginateLines(
		missingLines,
		(page, total) =>
			total > 1
				? `❓ Missing (${page}/${total})`
				: isSelf
					? "❓ Missing"
					: `❓ Missing from ${username}`,
		"#6c7086",
	);
}

function buildPages(
	inventory: IUserHorses | undefined,
	trainedForUser: ITrainedHorses[],
	allPossibleSlugs: string[],
	isSelf: boolean,
	username: string,
): { pages: PageData[]; ownedUniqueCount: number } {
	const { compLines, nonCompLines, ownedSlugs } =
		categorizeOwnedHorses(inventory);

	const pages: PageData[] = paginateLines(
		compLines,
		(page, total) => `🐎 Horses (${page}/${total})`,
		"#954535",
	);

	if (nonCompLines.length > 0) {
		pages.push({
			title: "👻 Specials & Secrets",
			color: "#cba6f7",
			lines: nonCompLines,
		});
	}

	const trainedLines = buildTrainedLines(trainedForUser, ownedSlugs);
	if (trainedLines.length > 0) {
		pages.push({
			title: "🏅 Trained Horses",
			color: "#f9e2af",
			lines: trainedLines,
		});
	}

	pages.push(
		...buildMissingPages(allPossibleSlugs, ownedSlugs, isSelf, username),
	);

	return { pages, ownedUniqueCount: ownedSlugs.size };
}

type NavDirection = "first" | "prev" | "next" | "last" | "jump";

function parseNavDirection(customId: string): NavDirection | undefined {
	const direction = customId.split("_", 2)[1];
	switch (direction) {
		case "first":
		case "prev":
		case "next":
		case "last":
		case "jump": {
			return direction;
		}

		case undefined: {
			return undefined;
		}

		default: {
			return undefined;
		}
	}
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
	const allTrained = await mongoose
		.model<ITrainedHorses>("TrainedHorses")
		.find();
	const trainedMap = new Map<string, ITrainedHorses[]>();
	for (const t of allTrained) {
		const array = trainedMap.get(t.ownerId) ?? [];
		array.push(t);
		trainedMap.set(t.ownerId, array);
	}

	const targetTrained = trainedMap.get(targetUser.id) ?? [];

	if (
		(!inventory?.horses ||
			inventory.horses.values().every((v) => v === 0)) &&
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
	const { pages, ownedUniqueCount } = buildPages(
		inventory,
		targetTrained,
		allPossibleSlugs,
		isSelf,
		targetUser.username,
	);
	const completionPercentage = Math.round(
		(ownedUniqueCount / allPossibleSlugs.length) * 100,
	);
	let currentPage = 0;

	function getHeaderEmbed() {
		return new EmbedBuilder()
			.setColor("#f1c40f")
			.setTitle(
				isSelf
					? "🐎 Your Collection 🐎"
					: `🐎 ${targetUser.username}'s Collection 🐎`,
			)
			.addFields(
				{ name: "Rank", value: `#${rank}`, inline: true },
				{
					name: "Net Worth",
					value: `$${userWorth.toLocaleString()}`,
					inline: true,
				},
				{
					name: "Completion",
					value: `${completionPercentage}%`,
					inline: true,
				},
			);
	}

	function getContentEmbed(page: number) {
		const p = pages[page];
		if (!p) {
			return new EmbedBuilder()
				.setColor("#6c7086")
				.setDescription("No data.");
		}

		const embed = new EmbedBuilder()
			.setColor(p.color)
			.setTitle(p.title);

		if (p.lines.length > 0) {
			embed.setDescription(p.lines.join("\n"));
		} else if (p.isMasteredPage) {
			embed.setDescription("🎉");
		}

		return embed;
	}

	function getComponents(page: number) {
		const rows: Array<ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>> = [];
		if (pages.length > 1) {
			const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId(`hc_first_${page}`)
					.setLabel("⏮")
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page === 0),
				new ButtonBuilder()
					.setCustomId(`hc_prev_${page}`)
					.setLabel("⬅")
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page === 0),
				new ButtonBuilder()
					.setCustomId(`hc_next_${page}`)
					.setLabel("➡")
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page >= pages.length - 1),
				new ButtonBuilder()
					.setCustomId(`hc_last_${page}`)
					.setLabel("⏭")
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page >= pages.length - 1),
			);
			rows.push(navRow);

			const maxDropdown = Math.min(pages.length, 25);
			const select = new StringSelectMenuBuilder()
				.setCustomId(`hc_jump_${page}`)
				.setPlaceholder(`Page ${page + 1} of ${pages.length}`)
				.addOptions(
					...Array.from({ length: maxDropdown }, (_, i) => ({
						label: pages[i]?.title ?? `Page ${i + 1}`,
						value: String(i),
						default: i === page,
					})),
				);
			rows.push(
				new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
			);
		}

		return rows;
	}

	const reply = await interaction.editReply({
		embeds: [getHeaderEmbed(), getContentEmbed(currentPage)],
		components: getComponents(currentPage),
	});

	if (pages.length <= 1) return;

	const collector = reply.createMessageComponentCollector({
		time: 5 * immutConfig.MINUTE_MS,
	});

	collector.on("collect", (i: ButtonInteraction | StringSelectMenuInteraction) => {
		void (async () => {
			if (i.user.id !== interaction.user.id) {
				await i.reply({
					content: "Only the command user can navigate.",
					flags: [MessageFlags.Ephemeral],
				}).catch(() => undefined);
				return;
			}

			let parsedPage = currentPage;
			const direction = parseNavDirection(i.customId);

			switch (direction) {
				case "first": {
					parsedPage = 0;
					break;
				}

				case "prev": {
					parsedPage = currentPage - 1;
					break;
				}

				case "next": {
					parsedPage = currentPage + 1;
					break;
				}

				case "last": {
					parsedPage = pages.length - 1;
					break;
				}

				case "jump": {
					if ("values" in i) parsedPage = Number(i.values[0]) || 0;
					break;
				}

				case undefined: {
					break;
				}
			}

			if (parsedPage < 0) parsedPage = 0;
			if (parsedPage >= pages.length) parsedPage = pages.length - 1;
			currentPage = parsedPage;

			try {
				await i.update({
					embeds: [getHeaderEmbed(), getContentEmbed(currentPage)],
					components: getComponents(currentPage),
				});
			} catch {
				await i.reply({
					content: "Failed to update page.",
					flags: [MessageFlags.Ephemeral],
				}).catch(() => undefined);
			}
		})().catch(() => undefined);
	});

	collector.on("end", () => {
		void interaction.editReply({
			embeds: [getHeaderEmbed(), getContentEmbed(currentPage)],
			components: [],
		}).catch(() => undefined);
	});
}
