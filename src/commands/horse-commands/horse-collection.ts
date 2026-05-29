import {
	SlashCommandSubcommandBuilder,
	type ChatInputCommandInteraction,
	MessageFlags,
} from 'discord.js';
import mongoose from 'mongoose';
import type {IUserHorses} from '../../lib/models.js';
import rawHorseValues from '../../data/horses.json' with {type: 'json'};
import {castAsHorseData, castAsTextBased} from '../../type-utils.js';
import {
	horseName,
	conditionHorse,
} from '../../lib/helpers/horse-funcs.js';

const HORSE_VALUES = castAsHorseData(rawHorseValues);

export const data = new SlashCommandSubcommandBuilder()
	.setName('collection')
	.setDescription('View a collection of horses')
	.addUserOption((option) =>
		option
			.setName('user')
			.setDescription('The user whose collection you want to view')
			.setRequired(false),
	)
	.addBooleanOption((option) =>
		option
			.setName('ephemeral')
			.setDescription(
				'Whether to show the collection ephemeral or publicly in the channel (defaults to ephemeral)',
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

			return {userId: u.userId, worth};
		})
		.toSorted((a, b) => b.worth - a.worth);

	const rank =
		leaderboard.findIndex((u) => u.userId === targetUserId) + 1;
	const userWorth =
		leaderboard.find((u) => u.userId === targetUserId)?.worth ?? 0;

	return {rank, userWorth};
}

function buildHorseInvList(inventory: IUserHorses) {
	let compHorseText = '';
	let nonCompHorseText = '';
	let ownedUniqueCount = 0;
	const ownedSlugs = new Set<string>();

	for (const [slug, count] of inventory.horses) {
		if (count <= 0 || !HORSE_VALUES[slug]) {
			continue;
		}

		const {value} = HORSE_VALUES[slug];
		const display = horseName(slug);
		const isComp = HORSE_VALUES[slug].comp !== false;
		const prefix =
			slug === 'dung_beetle'
				? '🪲'
				: slug.includes('providence')
					? '✨'
					: '🐎';

		if (isComp) {
			compHorseText += `* ${prefix} **${display}**: \`x${count}\` — ($${value.toLocaleString()})\n`;
			ownedSlugs.add(slug);
			ownedUniqueCount++;
		} else {
			// If comp:false, show if owned, counts to wealth but not completion
			nonCompHorseText += `* 👻 **${display}**: \`x${count}\` — ($${value.toLocaleString()})\n`;
		}
	}

	const horseListText =
		compHorseText +
		(nonCompHorseText
			? `\n### 👻 Specials and Secrets\n${nonCompHorseText}`
			: '');

	return {horseListText, ownedUniqueCount, ownedSlugs};
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
		? '### Missing Thingamabobs'
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
				.join('\n');
	} else {
		missingText = isSelf
			? '\n### ✨ You have mastered the gustovian stables! ✨'
			: `\n### ✨ ${username} has mastered the stables! ✨`;
	}

	return missingText;
}

export async function execute(
	interaction: ChatInputCommandInteraction,
) {
	const ephemeral =
		interaction.options.getBoolean('ephemeral') ?? true;
	await interaction.deferReply({
		flags: ephemeral ? [MessageFlags.Ephemeral] : [],
	});
	const targetUser =
		interaction.options.getUser('user') ?? interaction.user;
	const isSelf = targetUser.id === interaction.user.id;

	const allUsers = await mongoose
		.model<IUserHorses>('UserHorses')
		.find();
	const inventory = allUsers.find((u) => u.userId === targetUser.id);
	const allPossibleSlugs = Object.keys(HORSE_VALUES).filter(
		(k) => HORSE_VALUES[k]?.comp !== false,
	);

	if (
		!inventory?.horses ||
		[...inventory.horses.values()].every((v) => v === 0)
	) {
		return interaction.editReply({
			content: isSelf
				? 'Your stables are empty. Keep talking to find some horses!'
				: `${targetUser.username}'s stables are empty.`,
		});
	}

	const {rank, userWorth} = leaderboardStats(allUsers, targetUser.id);
	const {horseListText, ownedUniqueCount, ownedSlugs} =
		buildHorseInvList(inventory);
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
		? '## 🐎 Your Collection 🐎'
		: `## 🐎 ${targetUser.username}'s Collection 🐎`;
	const message = `${title}\n**Rank:** #${rank} | **Net Worth:** $${userWorth.toLocaleString()}\n**Completion:** ${completionPercentage}%\n${horseListText}${missingText}`;
	await interaction.editReply(message);
	let channel;
	try {
		channel = castAsTextBased(interaction.channel);
	} catch (error) {
		console.log(error);
		return interaction.editReply({
			content: `${message}\nSomething went wrong when trying to find the channel this was sent in, so some horses may have failed to be awarded\n${error instanceof Error ? error : undefined}`,
		});
	}

	// Run after reply so it never blocks the interaction response
	conditionHorse(inventory, channel).catch((error: unknown) => {
		console.error('conditionHorse error:', error);
	});
}
