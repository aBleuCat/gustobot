import {setTimeout as sleep} from 'node:timers/promises';
import {EmbedBuilder, type Message} from 'discord.js';
import {config} from '../../lib/config.js';
import type {ITrainedHorsesProps} from '../../lib/models.js';
import type {ReadyRaceChallenge} from './horse-race-challenge.js';

const {
	RACE_RANDOM_JITTER,
	RACE_TRACK_LENGTH,
	MAX_RACE_DURATION,
	RACE_MORALE_FACTOR,
} = config;

const RACE_TRACK_VISUAL_LENGTH = 10;

type RacingHorse = {
	position: number;
	userId: string;
	horse: ITrainedHorsesProps;
};

const specialHorseIcons: Record<string, string> = {
	unicorn: '🦄',
	dung_beetle: '🪲',
};

const randItem = <T>(array: T[]) =>
	array[Math.floor(Math.random() * array.length)];

function createTrackDisplay(
	users: RacingHorse[],
	commentary: string,
): EmbedBuilder {
	const tracks = Array.from({length: users.length}, () => [
		'🚦',
		...Array.from({length: RACE_TRACK_VISUAL_LENGTH}, () => '◻️'),
		'🏁',
	]);
	for (const [index, user] of users.entries()) {
		const position =
			user.position >= RACE_TRACK_LENGTH
				? RACE_TRACK_VISUAL_LENGTH
				: Math.floor(
						user.position /
							(RACE_TRACK_LENGTH / RACE_TRACK_VISUAL_LENGTH),
					);
		if (!tracks[index]) {
			continue;
		}

		tracks[index][position + 1] =
			specialHorseIcons[user.horse.breed] ?? '🏇';
	}

	return new EmbedBuilder()
		.setTitle('Horse Race')
		.setDescription(commentary)
		.addFields(
			Array.from({length: users.length}).map((_, i) => ({
				name: users[i]?.horse.name ?? 'Horse',
				value:
					tracks[i]?.join('') ??
					[
						'🚦',
						...Array.from(
							{
								length: RACE_TRACK_VISUAL_LENGTH,
							},
							() => '◻️',
						),
						'🏁',
					].join(''),
			})),
		);
}

const commentaryStrings = {
	lead: ['$horse is in the lead!', "$horse is first, but it's fine, first is the worst anyway"],
	significantLead: [
		'$horse is leaving everyone else in the dust!',
		'$horse is humbling the competition!',
		'Why are we just letting $horse win?',
		'$horse is mogging their competitors',
	],
	overtake: [
		'$horse overtakes $horse2 and takes first!',
		'$horse gallops ahead of $horse2 and takes the lead!',
	],
};

function getCommentary(raceTimeline: RacingHorse[][]) {
	const commentaryArray: string[] = [];
	for (const [i, tick] of raceTimeline.entries()) {
		if (i === 0) {
			commentaryArray.push('Go!');
			continue;
		}

		const currentPositions = tick.toSorted(
			(a, b) => b.position - a.position,
		);
		const previousPositions = raceTimeline[i - 1]?.toSorted(
			(a, b) => b.position - a.position,
		);
		const firstPlace = currentPositions[0];
		const secondPlace = currentPositions[1];
		const previousFirstPlace = previousPositions?.[0];
		if (!firstPlace || !secondPlace) {
			continue;
		}

		if (firstPlace.position - secondPlace.position > 300) {
			commentaryArray.push(
				randItem(commentaryStrings.significantLead)?.replaceAll(
					'$horse',
					firstPlace.horse.name,
				) ?? 'woah',
			);
		} else if (
			previousFirstPlace &&
			previousFirstPlace.horse !== firstPlace.horse
		) {
			commentaryArray.push(
				randItem(commentaryStrings.overtake)
					?.replaceAll('$horse', firstPlace.horse.name)
					.replaceAll('$horse2', previousFirstPlace.horse.name) ??
					'woah',
			);
		} else {
			commentaryArray.push(
				randItem(commentaryStrings.lead)?.replaceAll(
					'$horse',
					firstPlace.horse.name,
				) ?? 'woah',
			);
		}
	}

	return commentaryArray;
}

function computeRace(horses: ReadyRaceChallenge): RacingHorse[][] {
	let isExistsWinner = false;
	const computedRace: RacingHorse[][] = [
		horses.participants.map(({id, horse}): RacingHorse => ({
			position: 0,
			userId: id,
			horse,
		})),
	];
	const morale = Object.fromEntries(
		horses.participants.map((p) => [
			p.id,
			Math.ceil(Math.random() * RACE_MORALE_FACTOR),
		]),
	);
	while (
		!isExistsWinner &&
		computedRace.length <= MAX_RACE_DURATION
	) {
		const lastTick = computedRace.at(-1);
		if (!lastTick) {
			continue;
		}

		const newTick: RacingHorse[] = [];
		for (const {position, userId, horse} of lastTick) {
			const positionDelta =
				horse.speed +
				Math.ceil((Math.random() - 0.5) * 2 * RACE_RANDOM_JITTER) +
				(morale[userId] ?? 0);
			const newPosition =
				positionDelta <= 0 ? position : position + positionDelta;
			newTick.push({
				position: newPosition,
				userId,
				horse,
			});
		}

		computedRace.push(newTick);
		if (
			newTick.some((horse) => horse.position >= RACE_TRACK_LENGTH)
		) {
			isExistsWinner = true;
		}
	}

	return computedRace;
}

export async function executeRace(
	horses: ReadyRaceChallenge,
	message: Message,
) {
	const race = computeRace(horses);
	const commentary = getCommentary(race);
	const final = race
		.at(-1)
		?.toSorted((a, b) => b.position - a.position);
	const winner = final?.[0];
	for (const [i, tick] of race.entries()) {
		/* eslint-disable no-await-in-loop */
		await message.edit({
			embeds: [
				createTrackDisplay(
					tick,
					commentary[i] ?? 'exciting race, innit?',
				),
			],
		});
		await sleep(1000);
		/* eslint-enable no-await-in-loop */
	}

	const hasRaceCompleted = Boolean(
		final?.some((horse) => horse.position >= RACE_TRACK_LENGTH),
	);

	const resultsEmbed = new EmbedBuilder()
		.setTitle('Results')
		.setDescription(
			`The winner is...\n**${winner?.horse.name ?? 'no one?'}**`,
		);
	const statsEmbed = new EmbedBuilder().setTitle('Speed Stats');
	if (final) {
		const players = final.map((player) => player.horse.name);
		const finalPositions = final.map((player) =>
			Math.round(player.position),
		);
		resultsEmbed.addFields(
			{
				name: 'Players',
				value: players.join('\n'),
				inline: true,
			},
			{
				name: 'Final Position',
				value: finalPositions.join('\n'),
				inline: true,
			},
		);

		const ticksElapsed = race.length - 1;
		const nominalSpeeds = final.map((player) =>
			player.horse.speed.toFixed(2),
		);
		const averageSpeeds = final.map((player) =>
			ticksElapsed > 0
				? (player.position / ticksElapsed).toFixed(2)
				: '0.00',
		);
		statsEmbed.addFields(
			{
				name: 'Players',
				value: players.join('\n'),
				inline: true,
			},
			{
				name: 'Nominal Speed',
				value: nominalSpeeds.join('\n'),
				inline: true,
			},
			{
				name: 'Average Speed',
				value: averageSpeeds.join('\n'),
				inline: true,
			},
		);
	}

	await message.edit({
		content: hasRaceCompleted
			? 'The race has ended.'
			: 'This race was taking too long, so it ended.',
		embeds: [resultsEmbed, statsEmbed],
	});
}
