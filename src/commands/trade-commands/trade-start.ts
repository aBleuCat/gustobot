import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	type ChatInputCommandInteraction,
	ComponentType,
	MessageFlags,
	SlashCommandSubcommandBuilder,
} from "discord.js";
import {
	tradeMain,
	applyTradeResult,
	buildConfirmEmbed,
	buildAcceptedEmbed,
	buildFailedEmbed,
	buildExpiredEmbed,
	buildCancelledEmbed,
	buildDeclinedEmbed,
	buildConfirmTimeoutEmbed,
	type ResolvedTrade,
} from "../lib/trade-helpers.js";
import { config } from "../../lib/config.js";

export const data = new SlashCommandSubcommandBuilder()
	.setName("start")
	.setDescription("Trade horses and horse coin with people")
	.addUserOption((option) =>
		option
			.setName("user")
			.setDescription("User you wish to trade with")
			.setRequired(true),
	);

type ConfirmOutcome =
	| { status: "accepted" }
	| { status: "declined"; declinerId: string }
	| { status: "timeout" };

// Posts an accept/decline screen and waits for both participants to accept, or for either to decline. does not touch the database.
async function runConfirmScreen(
	interaction: ChatInputCommandInteraction,
	result: ResolvedTrade,
	buildConfirmEmbed: (trade: ResolvedTrade) => EmbedBuilder,
): Promise<ConfirmOutcome> {
	const acceptButton = new ButtonBuilder()
		.setCustomId("trade_accept")
		.setLabel("Accept")
		.setStyle(ButtonStyle.Success);
	const declineButton = new ButtonBuilder()
		.setCustomId("trade_decline")
		.setLabel("Decline")
		.setStyle(ButtonStyle.Danger);
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		acceptButton,
		declineButton,
	);

	const message = await interaction.editReply({
		embeds: [buildConfirmEmbed(result)],
		components: [row],
	});

	const participantIds = [result.red.id, result.blue.id];
	const accepted = new Set<string>();

	return new Promise((resolve) => {
		const collector = message.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: config.TRADE_CONFIRM_DURATION,
		});

		collector.on("collect", (buttonInteraction) => {
			void (async () => {
				if (
					!participantIds.includes(
						buttonInteraction.user.id,
					)
				) {
					await buttonInteraction.reply({
						content: "You're not part of this trade",
						flags: [MessageFlags.Ephemeral],
					});
					return;
				}

				if (buttonInteraction.customId === "trade_decline") {
					await buttonInteraction.reply({
						content: "You declined the trade",
						flags: [MessageFlags.Ephemeral],
					});
					collector.stop(
						`declined:${buttonInteraction.user.id}`,
					);
					return;
				}

				if (buttonInteraction.customId === "trade_accept") {
					accepted.add(buttonInteraction.user.id);
					await buttonInteraction.reply({
						content:
							accepted.size === participantIds.length
								? "Trade accepted!"
								: "You accepted. Waiting on the other user...",
						flags: [MessageFlags.Ephemeral],
					});

					if (accepted.size === participantIds.length)
						{collector.stop("accepted");}
				}
			})();
		});

		collector.on("end", (_collected, reason) => {
			if (reason === "accepted") {
				resolve({ status: "accepted" });
				return;
			}

			if (reason.startsWith("declined:")) {
				resolve({
					status: "declined",
					declinerId: reason.slice("declined:".length),
				});
				return;
			}

			resolve({ status: "timeout" });
		});
	});
}

export async function execute(
	interaction: ChatInputCommandInteraction,
) {
	await interaction.deferReply();
	const targetUser = interaction.options.getUser("user");
	const { channel } = interaction;
	if (!channel)
		{return interaction.editReply(
			"dasdfasdfasdfasdf idk your channel",
		);}

	if (!targetUser)
		{return interaction.editReply("Couldn't get ur inputs");}

	const trade = tradeMain.new(
		channel.id,
		interaction.user,
		targetUser,
	);
	trade.onUpdate((embeds, buttons) => {
		void interaction.editReply({
			content: `<@${targetUser.id}>, ${interaction.user.displayName} is offering a trade!`,
			embeds,
			components: [buttons],
		});
	});

	const initialReplyEmbeds = [
		new EmbedBuilder()
			.setTitle(interaction.user.displayName)
			.setDescription("Use `/trade add` to set your offer")
			.setColor("#181825"),
		new EmbedBuilder()
			.setTitle(targetUser.displayName)
			.setDescription("Use `/trade add` to set your offer")
			.setColor("#181825"),
	];
	const message = await interaction.editReply({
		content: `<@${targetUser.id}>, ${interaction.user.displayName} is offering a trade!`,
		embeds: initialReplyEmbeds,
		components: [trade.buttons],
	});

	const offerCollector = message.createMessageComponentCollector({
		componentType: ComponentType.Button,
		filter: (buttonInteraction) =>
			[
				"trade_lock",
				"trade_reset",
				"trade_cancel",
			].includes(buttonInteraction.customId),
		time: config.TRADE_DURATION,
	});

	offerCollector.on("collect", trade.collector);

	void trade.promise.finally(() => {
		offerCollector.stop();
	});

	const result = await trade.promise;

	if (!result) {
		const isCancelled = trade.cancelReason === "cancelled";
		let cancellerName: string | undefined;
		if (isCancelled && trade.cancellerId) {
			cancellerName =
				trade.red.id === trade.cancellerId
					? trade.red.name
					: trade.blue.name;
		}

		const embed =
			cancellerName !== undefined
				? buildCancelledEmbed(cancellerName)
				: buildExpiredEmbed();
		void interaction.editReply({
			embeds: [embed],
			components: [],
		});
		return;
	}

	const confirmation = await runConfirmScreen(
		interaction,
		result,
		buildConfirmEmbed,
	);

	if (confirmation.status === "declined") {
		const declinerName =
			confirmation.declinerId === result.red.id
				? result.red.name
				: result.blue.name;
		void interaction.editReply({
			embeds: [buildDeclinedEmbed(declinerName)],
			components: [],
		});
		return;
	}

	if (confirmation.status === "timeout") {
		void interaction.editReply({
			embeds: [buildConfirmTimeoutEmbed()],
			components: [],
		});
		return;
	}

	const applied = await applyTradeResult(result);

	void interaction.editReply({
		embeds: [
			applied.success
				? buildAcceptedEmbed(result)
				: buildFailedEmbed(applied.reason),
		],
		components: [],
	});
}
