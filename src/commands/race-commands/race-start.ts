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
import { raceMaster } from "../lib/horse-race-challenge.js";
import { executeRace } from "../lib/horse-race-run.js";

const { RACE_CHALLENGE_DURATION } = config;

export const data = new SlashCommandSubcommandBuilder()
	.setName("start")
	.setDescription("Challenge someone to a race")
	.addUserOption((option) =>
		option
			.setName("user")
			.setDescription("Who do you wanna challenge?")
			.setRequired(true),
	)
	.addUserOption((option) =>
		option
			.setName("user2")
			.setDescription("An optional third player to include"),
	)
	.addUserOption((option) =>
		option
			.setName("user3")
			.setDescription("An optional fourth player to include"),
	)
	.addUserOption((option) =>
		option
			.setName("user4")
			.setDescription("An optional fifth player to include"),
	);
export async function execute(
	interaction: ChatInputCommandInteraction,
) {
	const targetUser = interaction.options.getUser("user");
	const extraUsers = [
		interaction.options.getUser("user2"),
		interaction.options.getUser("user3"),
		interaction.options.getUser("user4"),
	].filter(
		(maybeUser): maybeUser is NonNullable<typeof maybeUser> =>
			Boolean(maybeUser ?? null),
	);
	const { channel, user } = interaction;

	if (!targetUser)
		return interaction.reply(
			"Failed to get your inputs, try again please",
		);
	if (!channel)
		return interaction.reply(
			"Couldn't figure out what channel this command was used in, try again",
		);

	const participantIds = [
		user.id,
		targetUser.id,
		...extraUsers.map((participant) => participant.id),
	];
	const distinctParticipantIds = [...new Set(participantIds)];

	if (distinctParticipantIds.length !== participantIds.length) {
		return interaction.reply({
			content: "You can't challenge the same person twice",
			flags: [MessageFlags.Ephemeral],
		});
	}

	if (distinctParticipantIds.length > 5) {
		return interaction.reply({
			content: "You can include up to five players in a race",
			flags: [MessageFlags.Ephemeral],
		});
	}

	if (raceMaster.exists(channel.id)) {
		return interaction.reply({
			content: "There's already an active race in this channel",
			flags: [MessageFlags.Ephemeral],
		});
	}

	const participantMentions = distinctParticipantIds
		.map((participantId) => `<@${participantId}>`)
		.join(", ");

	const challengeButtonRow =
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId("race_accept")
				.setLabel("Accept")
				.setStyle(ButtonStyle.Success),
		);
	const response = await interaction.reply({
		content: `## Horse Race Challenge\n${participantMentions} are about to race!\n-# Accept if you want to join`,
		components: [challengeButtonRow],
	});

	const message = await interaction.fetchReply();
	const acceptedUsers = new Set<string>();

	const collector = response.createMessageComponentCollector({
		time: RACE_CHALLENGE_DURATION,
	});

	collector.on(
		"collect",
		(buttonInteraction: ButtonInteraction) => {
			void handleRaceAcceptance(buttonInteraction);
		},
	);

	const handleRaceAcceptance = async (
		buttonInteraction: ButtonInteraction,
	): Promise<void> => {
		if (
			!distinctParticipantIds.includes(
				buttonInteraction.user.id,
			)
		) {
			await buttonInteraction.reply({
				content: `Yo can you read? This is for ${participantMentions}`,
				flags: [MessageFlags.Ephemeral],
			});
			return;
		}

		if (acceptedUsers.has(buttonInteraction.user.id)) {
			await buttonInteraction.reply({
				content: "You already accepted the challenge",
				flags: [MessageFlags.Ephemeral],
			});
			return;
		}

		acceptedUsers.add(buttonInteraction.user.id);
		await buttonInteraction.reply({
			content: "You have accepted the challenge",
			flags: [MessageFlags.Ephemeral],
		});

		if (acceptedUsers.size < distinctParticipantIds.length) {
			const remainingMentions = distinctParticipantIds
				.filter(
					(participantId) =>
						!acceptedUsers.has(participantId),
				)
				.map((participantId) => `<@${participantId}>`)
				.join(", ");
			await message.edit({
				content: `## Horse Race Challenge\nWaiting for ${remainingMentions} to accept`,
				components: [challengeButtonRow],
			});
			return;
		}

		collector.stop("accepted");

		let race: ReturnType<typeof raceMaster.new>;
		try {
			race = raceMaster.new(channel.id, distinctParticipantIds);
		} catch (error) {
			await message.edit({
				content:
					error instanceof Error
						? `Couldn't start the race: ${error.message}`
						: "Couldn't start the race, try again",
				embeds: [],
				components: [],
			});
			return;
		}

		race.onUpdate((update) => {
			void message.edit({ embeds: [update] });
		});

		void race.promise.then((readyChallenge) => {
			if (!readyChallenge) return; // Expired before everyone picked
			void executeRace(readyChallenge, message).catch(
				(error: unknown) => {
					console.error("Race execution failed:", error);
					void message.edit({
						content:
							"Something went wrong mid-race, sorry!",
						embeds: [],
						components: [],
					});
				},
			);
		});

		await message.edit({
			content:
				"## Horse Race Challenge\nEveryone has accepted. Select your horses!",
			embeds: [race.horsesEmbed],
			components: [],
		});
	};

	collector.on("end", (_, reason) => {
		if (reason === "time") {
			void message.edit({
				content:
					"The race challenge timed out before everyone accepted",
				embeds: [],
				components: [],
			});
		}
	});
}
