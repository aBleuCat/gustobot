import {
	TextDisplayBuilder,
	ContainerBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	SectionBuilder,
	MessageFlags,
	type InteractionEditReplyOptions,
} from "discord.js";
import mongoose from "mongoose";
import { config } from "../../lib/config.js";
import quests from "../../data/quests.js";
import { randSample } from "../../lib/helpers/random-helpers.js";
import {
	UserQuests,
	UserHorses,
	UserStats,
	type IUserQuests,
} from "../../lib/models.js";
import { discordTimestamp } from "../../lib/helpers/time-helpers.js";
import { capitalizeFirstLetter } from "../../lib/helpers/string-helpers.js";
import { horseName } from "../../lib/helpers/horse-funcs.js";

type QuestStatus = "claimed" | "completed" | "uncompleted";

const QUESTS_PER_PAGE = 4;
const colorToStatus = {
	claimed: 0xa6_e3_a1,
	completed: 0xfa_b3_87,
	uncompleted: 0xf3_8b_a8,
};

type QuestType = "daily" | "weekly";

function groupIntoChunks<T>(array: T[], chunkLength: number): T[][] {
	const result: T[][] = [];
	for (let i = 0; i < array.length; i += chunkLength) {
		result.push(array.slice(i, i + chunkLength));
	}

	return result;
}

function nextQuestRefresh(questType: "daily" | "weekly") {
	const zdtNow = Temporal.Now.zonedDateTimeISO("America/New_York");
	let daysToAdd =
		questType === "weekly" ? (7 - zdtNow.dayOfWeek) % 7 : 1;
	if (questType === "weekly" && daysToAdd === 0) {
		daysToAdd = 7; // If today is Sunday, skip to the following Sunday
	}

	return zdtNow
		.add({ days: daysToAdd })
		.with({ hour: 0, minute: 0, second: 0, millisecond: 0 }); // Resets at 12 AM; people will probably still be awake by then
}

// eslint-disable-next-line unicorn/consistent-boolean-name
export async function attemptQuestRefresh(
	userId: string,
	questType: "daily" | "weekly",
) {
	const difficulties:
		| [
				"WEEKLY_EASY_QUESTS",
				"WEEKLY_MEDIUM_QUESTS",
				"WEEKLY_HARD_QUESTS",
		  ]
		| [
				"DAILY_EASY_QUESTS",
				"DAILY_MEDIUM_QUESTS",
				"DAILY_HARD_QUESTS",
		  ] =
		questType === "weekly"
			? [
					"WEEKLY_EASY_QUESTS",
					"WEEKLY_MEDIUM_QUESTS",
					"WEEKLY_HARD_QUESTS",
				]
			: [
					"DAILY_EASY_QUESTS",
					"DAILY_MEDIUM_QUESTS",
					"DAILY_HARD_QUESTS",
				];
	const newUnclaimedItems = [
		...randSample(
			Object.entries(quests[questType]).filter(
				([, { difficulty }]) => difficulty === "easy",
			),
			config[difficulties[0]],
		),
		...randSample(
			Object.entries(quests[questType]).filter(
				([, { difficulty }]) => difficulty === "medium",
			),
			config[difficulties[1]],
		),
		...randSample(
			Object.entries(quests[questType]).filter(
				([, { difficulty }]) => difficulty === "hard",
			),
			config[difficulties[2]],
		),
	].map(([name]) => name);

	const nextRefreshZdt = nextQuestRefresh(questType);

	const nextRefreshDate = new Date(
		nextRefreshZdt.epochMilliseconds,
	);
	const nowEpochMs = Temporal.Now.instant().epochMilliseconds;
	try {
		await UserQuests.updateOne(
			{ userId },
			{ $setOnInsert: { userId } },
			{ upsert: true, setDefaultsOnInsert: true },
		);
	} catch (error: unknown) {
		if (!(
			error instanceof mongoose.mongo.MongoServerError &&
			error.code === 11_000
		)) {
			throw error;
		}
	}

	const updatedUser = await UserQuests.findOneAndUpdate(
		{
			userId,
			$or: [
				{
					[questType + ".nextRefresh"]: {
						$lte: new Date(nowEpochMs),
					},
				},
				{
					[questType + ".nextRefresh"]: {
						$exists: false,
					},
				},
			],
		},
		[
			{
				$set: {
					// Conditionally increment streak atomically, handling new inserts via $ifNull
					[questType + ".questStreak"]: {
						$cond: {
							if: {
								$and: [
									{
										$eq: [
											{
												$size: {
													$ifNull: [
														"$" +
															questType +
															".unclaimed",
														[],
													],
												},
											},
											0,
										],
									},
									{
										$gt: [
											{
												$size: {
													$ifNull: [
														"$" +
															questType +
															".claimed",
														[],
													],
												},
											},
											0,
										],
									},
								],
							},
							// eslint-disable-next-line unicorn/no-thenable
							then: {
								$add: [
									{
										$ifNull: [
											"$" +
												questType +
												".questStreak",
											0,
										],
									},
									1,
								],
							},
							else: {
								$ifNull: [
									"$" + questType + ".questStreak",
									0,
								],
							},
						},
					},
					// Reset fields and assign new items
					[questType + ".claimed"]: [],
					[questType + ".unclaimed"]: newUnclaimedItems,
					[questType + ".rerollsUsed"]: 0,
					[questType + ".nextRefresh"]: nextRefreshDate,
				},
			},
		],
		{
			new: true,
			setDefaultsOnInsert: true,
		},
	);

	return Boolean(updatedUser);
}

async function claimCompletedQuests(
	userId: string,
	questType: QuestType,
	questNames?: string[],
): Promise<string[]> {
	const questDocument = await UserQuests.findOne({ userId });
	if (!questDocument) return [];

	const { unclaimed } = questDocument[questType];
	const requestedQuests = (questNames ?? unclaimed).flatMap(
		(questName) => {
			const quest = quests[questType][questName];
			return quest && unclaimed.includes(questName)
				? [{ questName, quest }]
				: [];
		},
	);
	if (requestedQuests.length === 0) return [];

	const statsDocument = await UserStats.findOneAndUpdate(
		{ userId },
		{},
		{ new: true, upsert: true, setDefaultsOnInsert: true },
	);
	const timeframeStats =
		questType === "daily"
			? statsDocument.daily
			: statsDocument.weekly;
	const completedQuests = requestedQuests.filter(
		({ quest }) => quest.getCompletion(timeframeStats) >= 1,
	);
	if (completedQuests.length === 0) return [];

	const session = await mongoose.startSession();
	let claimedQuests: string[] = [];
	try {
		await session.withTransaction(async () => {
			claimedQuests = [];
			for (const { questName, quest } of completedQuests) {
				// eslint-disable-next-line no-await-in-loop -- transaction operations must run sequentially
				const claimed = await UserQuests.findOneAndUpdate(
					{
						userId,
						[`${questType}.unclaimed`]: questName,
					},
					{
						$pull: {
							[`${questType}.unclaimed`]: questName,
						},
						$addToSet: {
							[`${questType}.claimed`]: questName,
						},
					},
					{ new: true, session },
				);
				if (!claimed) continue;

				const rewardIncrements: Record<string, number> = {
					...(quest.reward.coins !== undefined && {
						horseCoins: quest.reward.coins,
					}),
					...(quest.reward.horse !== undefined && {
						[`horses.${quest.reward.horse}`]: 1,
					}),
				};

				if (Object.keys(rewardIncrements).length > 0) {
					// eslint-disable-next-line no-await-in-loop -- transaction operations must run sequentially
					await UserHorses.updateOne(
						{ userId },
						{ $inc: rewardIncrements },
						{ upsert: true, session },
					);
				}

				claimedQuests.push(questName);
			}
		});
	} finally {
		await session.endSession();
	}

	return claimedQuests;
}

export async function claimQuest(
	userId: string,
	questType: QuestType,
	questName: string,
): Promise<string | undefined> {
	const claimedQuests = await claimCompletedQuests(
		userId,
		questType,
		[questName],
	);
	return claimedQuests[0];
}

export async function claimAllCompletedQuests(
	userId: string,
	questType: QuestType,
): Promise<string[]> {
	return claimCompletedQuests(userId, questType);
}

export async function didRerollUncompletedQuests(
	userId: string,
	questType: QuestType,
): Promise<boolean> {
	const questDocument = await UserQuests.findOne({ userId });
	if (!questDocument) return false;

	const timeframeQuests = questDocument[questType];
	if (timeframeQuests.rerollsUsed >= 1) return false;

	const statsDocument = await UserStats.findOneAndUpdate(
		{ userId },
		{},
		{ new: true, upsert: true, setDefaultsOnInsert: true },
	);
	const timeframeStats =
		questType === "daily"
			? statsDocument.daily
			: statsDocument.weekly;
	const uncompletedQuests = timeframeQuests.unclaimed.flatMap(
		(questName) => {
			const quest = quests[questType][questName];
			return quest && !quest.isCompleted(timeframeStats)
				? [{ questName, difficulty: quest.difficulty }]
				: [];
		},
	);
	if (uncompletedQuests.length === 0) return false;

	const occupiedQuests = new Set([
		...timeframeQuests.claimed,
		...timeframeQuests.unclaimed,
	]);
	const newUnclaimedQuests = [...timeframeQuests.unclaimed];
	let rerolledCount = 0;

	for (const { questName, difficulty } of uncompletedQuests) {
		const candidates = Object.entries(quests[questType]).filter(
			([candidateName, quest]) =>
				quest.difficulty === difficulty &&
				!occupiedQuests.has(candidateName),
		);
		const [replacement] = randSample(candidates, 1);
		if (!replacement) continue;

		const [replacementName] = replacement;
		const questIndex = newUnclaimedQuests.indexOf(questName);
		if (questIndex === -1) continue;

		newUnclaimedQuests[questIndex] = replacementName;
		occupiedQuests.add(replacementName);
		rerolledCount++;
	}

	if (rerolledCount === 0) return false;

	const updatedQuestDocument = await UserQuests.findOneAndUpdate(
		{
			userId,
			[`${questType}.unclaimed`]: timeframeQuests.unclaimed,
			$or: [
				{ [`${questType}.rerollsUsed`]: { $lt: 1 } },
				{
					[`${questType}.rerollsUsed`]: {
						$exists: false,
					},
				},
			],
		},
		{
			$set: {
				[`${questType}.unclaimed`]: newUnclaimedQuests,
			},
			$inc: { [`${questType}.rerollsUsed`]: 1 },
		},
		{ new: true },
	);

	return Boolean(updatedQuestDocument);
}

const banana = {
	claimed: 3,
	completed: 2,
	uncompleted: 1,
};

function questStatusSortingHelper(
	statusA: QuestStatus,
	statusB: QuestStatus,
	completionA?: number,
	completionB?: number,
) {
	return statusA === "uncompleted" && statusB === "uncompleted"
		? (completionB ?? 1) - (completionA ?? 1)
		: banana[statusB] - banana[statusA];
}

export async function buildQuestPagesFromDocument(
	document: IUserQuests,
	questType: "daily" | "weekly",
) {
	const { userId } = document;
	const statsDocument = await UserStats.findOneAndUpdate(
		{ userId },
		{},
		{ new: true, upsert: true, setDefaultsOnInsert: true },
	);
	const timeframeStatsDocument =
		questType === "daily"
			? statsDocument.daily
			: statsDocument.weekly;

	const timeframeQuests = [
		...document[questType].claimed.map((quest) => ({
			quest,
			status: "claimed" as const,
			...quests[questType][quest],
		})),
		...document[questType].unclaimed
			.filter((quest) =>
				quests[questType][quest]?.isCompleted(
					timeframeStatsDocument,
				),
			)
			.map((quest) => ({
				quest,
				status: "completed" as const,
				...quests[questType][quest],
			})),
		...document[questType].unclaimed
			.filter(
				(quest) =>
					quests[questType][quest]?.isCompleted(
						timeframeStatsDocument,
					) === false,
			)
			.map((quest) => ({
				quest,
				status: "uncompleted" as const,
				completion:
					quests[questType][quest]?.getCompletion(
						timeframeStatsDocument,
					) ?? 0,
				...quests[questType][quest],
			})),
	].toSorted((a, b) =>
		questStatusSortingHelper(
			a.status,
			b.status,
			a.status === "uncompleted" ? a.completion : undefined,
			b.status === "uncompleted" ? b.completion : undefined,
		),
	);

	const groupedQuests = groupIntoChunks(
		timeframeQuests,
		QUESTS_PER_PAGE,
	).map((chunk) => Object.groupBy(chunk, (quest) => quest.status));

	return groupedQuests;
}

export function buildOverviewContainer(
	document: IUserQuests,
	questType: "daily" | "weekly",
	hasRefreshed: boolean,
): ContainerBuilder {
	const nextRefresh = nextQuestRefresh(questType);
	const claimed = document[questType].claimed.length;
	const unclaimed = document[questType].unclaimed.length;
	const total = claimed + unclaimed;
	const isRerollAvailable = document[questType].rerollsUsed < 1;
	const container = new ContainerBuilder()
		.setAccentColor(0x18_18_25)
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				"# Overview\n" +
					`Claimed ${claimed} of ${total} quests (${((claimed / (total || 1)) * 100).toFixed(0)}%)\n` +
					`Your quests will reset ${discordTimestamp(nextRefresh, "relative")}`,
			),
		);
	if (hasRefreshed) {
		container
			.addSeparatorComponents(
				new SeparatorBuilder()
					.setDivider(true)
					.setSpacing(SeparatorSpacingSize.Small),
			)
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					`The ${questType === "daily" ? "day" : "week"} has ended, and your quests have refreshed!\nGet back to work!`,
				),
			);
	}

	if (isRerollAvailable) {
		container
			.addSeparatorComponents(
				new SeparatorBuilder()
					.setDivider(true)
					.setSpacing(SeparatorSpacingSize.Small),
			)
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					"If you really don't like your quests, you can reroll once.",
				),
			);
	} else {
		container
			.addSeparatorComponents(
				new SeparatorBuilder()
					.setDivider(true)
					.setSpacing(SeparatorSpacingSize.Small),
			)
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					"You've used your free reroll! You'll get a free reroll again after your quests reset.",
				),
			);
	}

	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setLabel("Reroll")
				.setCustomId("reroll")
				.setDisabled(!isRerollAvailable)
				.setStyle(ButtonStyle.Danger),
		),
	);

	return container;
}

export function buildQuestContainer(
	questsChunk: Exclude<
		Awaited<
			ReturnType<typeof buildQuestPagesFromDocument>
		>[number][QuestStatus],
		undefined
	>,
	questStatus: QuestStatus,
) {
	const sections = questsChunk.map((quest) => {
		const section = new SectionBuilder().addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				`## ${quest.name ?? "Unknown"}\n` +
					`${quest.description ?? "Unknown"}\n` +
					"Rewards:" +
					(quest.reward?.horse
						? `\n${horseName(quest.reward.horse)}`
						: "") +
					(quest.reward?.coins
						? `\n🪙 ${quest.reward.coins} Horse Coins`
						: ""),
			),
		);
		if (quest.status === "completed") {
			section.setButtonAccessory(
				new ButtonBuilder()
					.setLabel("Claim")
					.setCustomId(`claim_${quest.quest}`)
					.setStyle(ButtonStyle.Success),
			);
		} else {
			section.setButtonAccessory(
				new ButtonBuilder()
					.setLabel(
						quest.status === "claimed"
							? "Claimed"
							: `${Math.round((quest.completion ?? 0) * 100)}%`,
					)
					.setCustomId(
						`quest_${quest.status}_${quest.quest}`,
					)
					.setDisabled(true)
					.setStyle(ButtonStyle.Secondary),
			);
		}

		return section;
	});

	const container = new ContainerBuilder()
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				`# ${capitalizeFirstLetter(questStatus)}`,
			),
		)
		.setAccentColor(colorToStatus[questStatus]);

	if (questStatus === "completed") {
		container.addActionRowComponents(
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setLabel("Claim All")
					.setCustomId("claimall")
					.setStyle(ButtonStyle.Success),
			),
		);
	}

	for (const section of sections) {
		container
			.addSeparatorComponents(
				new SeparatorBuilder()
					.setDivider(true)
					.setSpacing(SeparatorSpacingSize.Large),
			)
			.addSectionComponents(section);
	}

	return container;
}

export function buildQuestsPage(
	document: IUserQuests,
	page: Awaited<
		ReturnType<typeof buildQuestPagesFromDocument>
	>[number],
	{ index, total }: { index: number; total: number },
	{
		questType,
		hasRefreshed,
	}: { questType: "daily" | "weekly"; hasRefreshed: boolean },
): InteractionEditReplyOptions {
	const pageEntries = Object.entries(page) as Array<
		[
			QuestStatus,
			Exclude<
				Awaited<
					ReturnType<typeof buildQuestPagesFromDocument>
				>[number][QuestStatus],
				undefined
			>,
		]
	>;
	const components = [
		buildOverviewContainer(document, questType, hasRefreshed),
		...pageEntries.map(([status, section]) =>
			buildQuestContainer(section, status),
		),
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setLabel("⬅️")
				.setCustomId(`page_${Math.max(0, index - 1)}`)
				.setDisabled(index <= 0)
				.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
				.setLabel(`Page ${index + 1}/${total}`)
				.setCustomId("pageselect")
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setLabel("➡️")
				.setCustomId(`page_${Math.max(0, index + 1)}`)
				.setDisabled(index + 1 >= total)
				.setStyle(ButtonStyle.Primary),
		),
	];

	return {
		flags: [MessageFlags.IsComponentsV2],
		components,
	};
}
