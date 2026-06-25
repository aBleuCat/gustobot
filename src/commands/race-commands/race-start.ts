import {
	ActionRowBuilder,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	type ChatInputCommandInteraction,
	MessageFlags,
	SlashCommandSubcommandBuilder,
} from "discord.js";
import { config } from "../../lib/config.js";
import { raceMaster } from "../horse-race-main.js";

const { RACE_CHALLENGE_DURATION, RACE_FINAL_CONFIRMATION_TIME } =
	config;

export const data = new SlashCommandSubcommandBuilder()
	.setName("start")
	.setDescription("Challenge someone to a race")
	.addUserOption((option) =>
		option
			.setName("user")
			.setDescription("Who do you wanna challenge?")
			.setRequired(true),
	);
export async function execute(
	interaction: ChatInputCommandInteraction,
) {
	const targetUser = interaction.options.getUser("user");
	const { channel, user } = interaction;

	if (!targetUser)
		return interaction.reply(
			"Failed to get your inputs, try again please",
		);
	if (!channel)
		return interaction.reply(
			"Couldn't figure out what channel this command was used in, try again",
		);
	const redId = user.id;
	const blueId = targetUser.id;

	const challengeButtonRow =
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(`race_accept_${blueId}`)
				.setLabel("Accept")
				.setStyle(ButtonStyle.Success),
		);
	// Ping em both for good measure
	const response = await interaction.reply({
		content: `## Horse Race Challenge\n<@${redId}> has challenged <@${blueId}> to a horse race!\n-# It would be very mean if you didn't accept`,
		components: [challengeButtonRow],
	});

	const message = await interaction.fetchReply();

	const collector = response.createMessageComponentCollector({
		time: RACE_CHALLENGE_DURATION,
	});

	collector.on(
		"collect",
		(buttonInteraction: ButtonInteraction) => {
			(async (buttonInteraction: ButtonInteraction) => {
				if (buttonInteraction.user.id !== blueId)
					return buttonInteraction.reply({
						content: `Yo can you read? This is for <@${blueId}>`,
						flags: [MessageFlags.Ephemeral],
					});

				await buttonInteraction.reply({
					content: "You have accepted the challenge",
					flags: [MessageFlags.Ephemeral],
				});

				collector.stop("accepted");

				await interaction.editReply({
					content: `## Horse Race Challenge\n<@${blueId}> has accepted the challenge\n<@${redId}> and <@${blueId}>, select your horses`,
					components: [],
				});

				let accepted = false;
				/* eslint-disable no-await-in-loop, @typescript-eslint/no-loop-func */
				while (!accepted) {
					const race = raceMaster.new(
						channel.id,
						redId,
						blueId,
					);
					race.onUpdate((update) => {
						void message.edit({ embeds: [update] });
					});
					const result = await race.promise;

					if (!result) {
						return message.edit({
							content:
								"You guys took too long bro it timed out",
							embeds: [],
							components: [],
						});
					}

					const acceptButton = new ButtonBuilder()
						.setCustomId("race_accept")
						.setLabel("Accept")
						.setStyle(ButtonStyle.Success);
					const cancelButton = new ButtonBuilder()
						.setCustomId("race_cancel")
						.setLabel("Cancel")
						.setStyle(ButtonStyle.Danger);
					const row =
						new ActionRowBuilder<ButtonBuilder>().setComponents(
							acceptButton,
							cancelButton,
						);

					const confirmationMessage = await message.edit({
						content:
							"Both horses are ready. Do you wish to proceed?",
						embeds: [race.horsesEmbed],
						components: [row],
					});
					try {
						// Track who has accepted
						const acceptedUsers = new Set<string>();
						let timedOutOrCancelled = false;

						const decisionCollector =
							confirmationMessage.createMessageComponentCollector(
								{
									filter: (i) =>
										i.user.id === redId ||
										i.user.id === blueId,
									time: RACE_FINAL_CONFIRMATION_TIME,
								},
							);

						await new Promise<void>((resolve, reject) => {
							decisionCollector.on("collect", (i) => {
								(async (i) => {
									if (
										i.customId === "race_cancel"
									) {
										// If any player cancels, stop the collector immediately
										timedOutOrCancelled = true;
										decisionCollector.stop(
											"cancelled",
										);

										await i.update({
											content: `<@${i.user.id}> cancelled. Reselect your horses`,
											embeds: [],
											components: [],
										});
										resolve();
										return;
									}

									if (
										i.customId === "race_accept"
									) {
										acceptedUsers.add(i.user.id);

										if (
											acceptedUsers.size === 2
										) {
											decisionCollector.stop(
												"both_accepted",
											);
											accepted = true;

											await i.update({
												content:
													"Both players have accepted! The race is starting!",
												components: [],
											});
											resolve();
										} else {
											// Only one person accepted so far, update the status
											await i.update({
												content: `<@${i.user.id}> accepted! Waiting for the other player`,
												components: [row],
											});
										}
									}
								})(i);
							});

							decisionCollector.on(
								"end",
								(_, reason) => {
									if (reason === "time") {
										reject(new Error("timeout"));
									}
								},
							);
						});

						if (timedOutOrCancelled) continue;
					} catch {
						return message.edit({
							content:
								"Timed out waiting for both players to confirm. Cancelled.",
							embeds: [],
							components: [],
						});
					}

					// Race here
				}
				/* eslint-enable no-await-in-loop, @typescript-eslint/no-loop-func */
			})(buttonInteraction);
		},
	);
}
