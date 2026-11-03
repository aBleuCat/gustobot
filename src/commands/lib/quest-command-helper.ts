import {
	ComponentType,
	MessageFlags,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
} from "discord.js";
import { immutConfig } from "../../lib/config.js";
import { Settings, UserQuests } from "../../lib/models.js";
import {
	claimAllCompletedQuests,
	claimQuest,
	attemptQuestRefresh,
	buildQuestPagesFromDocument,
	buildQuestsPage,
	didRerollUncompletedQuests,
} from "./quest-helpers.js";

type QuestType = "daily" | "weekly";

async function buildQuestPage(
	userId: string,
	questType: QuestType,
	pageIndex: number,
	hasRefreshed: boolean,
) {
	const document = await UserQuests.findOne({ userId });
	if (!document) {
		throw new Error(
			`Quest document not found for user ${userId}`,
		);
	}

	const pages = await buildQuestPagesFromDocument(
		document,
		questType,
	);
	const total = Math.max(1, pages.length);
	const index = Math.min(Math.max(0, pageIndex), total - 1);
	const page = pages[index] ?? {};

	return {
		index,
		payload: buildQuestsPage(
			document,
			page,
			{ index, total },
			{ questType, hasRefreshed },
		),
	};
}

async function handleQuestButton(
	interaction: ButtonInteraction,
	questType: QuestType,
	pageIndex: { value: number },
	refreshed: { value: boolean },
): Promise<void> {
	if (interaction.customId === "pageselect") {
		await interaction.deferUpdate();
		return;
	}

	const pagePrefix = "page_";
	const pageValue = interaction.customId.startsWith(pagePrefix)
		? Number(interaction.customId.slice(pagePrefix.length))
		: NaN;
	const pageNumber = Number.isSafeInteger(pageValue)
		? pageValue
		: undefined;
	const questName = interaction.customId.startsWith("claim_")
		? interaction.customId.slice("claim_".length)
		: undefined;
	const isKnownButton =
		pageNumber !== undefined ||
		interaction.customId === "claimall" ||
		interaction.customId === "reroll" ||
		questName !== undefined;
	if (!isKnownButton) {
		await interaction.reply({
			content: "This quest button is no longer available.",
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	await interaction.deferUpdate();
	let notice: string | undefined;

	if (pageNumber !== undefined) {
		pageIndex.value = pageNumber;
	} else if (interaction.customId === "claimall") {
		const claimed = await claimAllCompletedQuests(
			interaction.user.id,
			questType,
		);
		if (claimed.length === 0) {
			notice = "There are no completed quests to claim.";
		}
	} else if (interaction.customId === "reroll") {
		const didReroll = await didRerollUncompletedQuests(
			interaction.user.id,
			questType,
		);
		if (!didReroll) {
			notice =
				"You have used your reroll, or there are no uncompleted quests with replacements available.";
		}
	} else if (questName) {
		const claimed = await claimQuest(
			interaction.user.id,
			questType,
			questName,
		);
		if (!claimed) {
			notice = "That quest is no longer available to claim.";
		}
	}

	refreshed.value = false;
	const page = await buildQuestPage(
		interaction.user.id,
		questType,
		pageIndex.value,
		refreshed.value,
	);
	pageIndex.value = page.index;
	await interaction.editReply(page.payload);

	if (notice) {
		await interaction.followUp({
			content: notice,
			flags: [MessageFlags.Ephemeral],
		});
	}
}

export async function executeQuestCommand(
	interaction: ChatInputCommandInteraction,
	questType: QuestType,
): Promise<void> {
	const isEphemeral =
		interaction.options.getBoolean("ephemeral") ?? true;
	await interaction.deferReply({
		flags: isEphemeral ? [MessageFlags.Ephemeral] : [],
	});
	const userId = interaction.user.id;
	const hasRefreshed = await attemptQuestRefresh(userId, questType);
	const settings = await Settings.findOne(
		{ userId },
		{ questsAutoclaim: 1 },
	).lean();
	const autoClaimOverride =
		interaction.options.getBoolean("autoclaim");

	if (
		autoClaimOverride !== false &&
		settings?.questsAutoclaim !== false
	) {
		await claimAllCompletedQuests(userId, questType);
	}

	const pageIndex = { value: 0 };
	const refreshed = { value: hasRefreshed };
	const initialPage = await buildQuestPage(
		userId,
		questType,
		pageIndex.value,
		refreshed.value,
	);
	pageIndex.value = initialPage.index;
	const message = await interaction.editReply(initialPage.payload);
	const collector = message.createMessageComponentCollector({
		componentType: ComponentType.Button,
		time: 10 * immutConfig.MINUTE_MS,
	});

	collector.on("collect", (buttonInteraction) => {
		if (buttonInteraction.user.id !== userId) {
			void buttonInteraction
				.reply({
					content:
						"Only the person who opened these quests can use these buttons.",
					flags: [MessageFlags.Ephemeral],
				})
				.catch((error: unknown) => {
					console.error(
						"Failed to reject another user's quest interaction:",
						error,
					);
				});
			return;
		}

		void handleQuestButton(
			buttonInteraction,
			questType,
			pageIndex,
			refreshed,
		).catch(async (error: unknown) => {
			console.error("Failed to handle quest button:", error);
			try {
				await buttonInteraction.followUp({
					content:
						"That quest action failed. Please try again.",
					flags: [MessageFlags.Ephemeral],
				});
			} catch (replyError: unknown) {
				console.error(
					"Failed to report quest button error:",
					replyError,
				);
			}
		});
	});
}
