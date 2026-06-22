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
import {
	raceChallenges,
	type RaceChallenge,
} from "../horse-race-main.js";

const { RACE_CHALLENGE_DURATION } = config;

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

				const raceChallengeObject: RaceChallenge = {
					redId,
					blueId,
				};

				raceChallenges.set(channel.id, raceChallengeObject);
				// To do: wagers (later), wait for horses to be selected, the race itself
				// RaceChallenge should be a class that on its own handles waiting for trained horse inputs
				// and expiration
			})(buttonInteraction);
		},
	);
}
