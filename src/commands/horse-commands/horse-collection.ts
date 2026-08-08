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
import type { IUserHorses } from "../../lib/models.js";
import rawHorseValues from "../../data/horses.json" with { type: "json" };
import { castAsHorseData } from "../../type-utils.js";
import { horseName } from "../../lib/helpers/horse-funcs.js";
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
	targetUserId: string,
) {
	const leaderboard = allUsers
		.map((u) => {
			let worth = 0;
			for (const [slug, count] of u.horses) {
				worth += (HORSE_VALUES[slug]?.value ?? 0) * count;
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
	color: string;
	lines: string[];
};

function buildPages(
	inventory: IUserHorses,
	allPossibleSlugs: string[],
	isSelf: boolean,
	username: string,
): PageData[] {
	const pages: PageData[] = [];
	const compLines: string[] = [];
	const nonCompLines: string[] = [];
	const ownedSlugs = new Set<string>();

	for (const [slug, count] of inventory.horses) {
		const horseData = HORSE_VALUES[slug];
		if (count <= 0 || !horseData) continue;
		const { value } = horseData;
		const display = horseName(slug);
		const isComp = horseData.comp !== false;
		const prefix =
			slug === "dung_beetle"
				? "🪲"
				: slug.includes("providence")
					? "✨"
					: "🐎";
		const line = `${prefix} **${display}** ×${count} — $${value.toLocaleString()}`;

		if (isComp) {
			compLines.push(line);
			ownedSlugs.add(slug);
		} else {
			nonCompLines.push(line);
		}
	}

	// Competitive horses pages
	if (compLines.length > 0) {
		const totalPages = Math.ceil(compLines.length / HORSES_PER_PAGE);
		for (let i = 0; i < totalPages; i++) {
			const start = i * HORSES_PER_PAGE;
			const chunk = compLines.slice(start, start + HORSES_PER_PAGE);
			pages.push({
				title: `🐎 Horses (${i + 1}/${totalPages})`,
				color: "#954535",
				lines: chunk,
			});
		}
	}

	// Specials page
	if (nonCompLines.length > 0) {
		pages.push({
			title: "👻 Specials & Secrets",
			color: "#cba6f7",
			lines: nonCompLines,
		});
	}

	// Missing page
	const missing = allPossibleSlugs.filter(
		(slug) => !ownedSlugs.has(slug),
	);
	if (missing.length > 0) {
		const missingLines = missing.map((slug) => {
			const mValue = HORSE_VALUES[slug]?.value ?? 0;
			return `*${horseName(slug)}* ($${mValue.toLocaleString()})`;
		});
		const missingPages = Math.ceil(missingLines.length / HORSES_PER_PAGE);
		for (let i = 0; i < missingPages; i++) {
			const start = i * HORSES_PER_PAGE;
			const chunk = missingLines.slice(start, start + HORSES_PER_PAGE);
			pages.push({
				title: missingPages > 1
					? `❓ Missing (${i + 1}/${missingPages})`
					: (isSelf ? "❓ Missing" : `❓ Missing from ${username}`),
				color: "#6c7086",
				lines: chunk,
			});
		}
	} else {
		pages.push({
			title: isSelf ? "✨ Mastered!" : `✨ ${username} has mastered the stables!`,
			color: "#a6e3a1",
			lines: [],
		});
	}

	return pages;
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

	if (
		!inventory?.horses ||
		inventory.horses.values().every((v) => v === 0)
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
		targetUser.id,
	);
	const ownedUniqueCount = [...inventory.horses]
		.filter(
			([slug, count]) => count > 0 && HORSE_VALUES[slug] && HORSE_VALUES[slug].comp !== false,
		).length;
	const completionPercentage = Math.round(
		(ownedUniqueCount / allPossibleSlugs.length) * 100,
	);

	const pages = buildPages(inventory, allPossibleSlugs, isSelf, targetUser.username);
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
			.setColor(p.color as `#${string}`)
			.setTitle(p.title);

		if (p.lines.length > 0) {
			embed.setDescription(p.lines.join("\n"));
		} else if (p.title.includes("Mastered")) {
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
			const parts = i.customId.split("_");
			const direction = parts[1];

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

				default: {
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
