import { EmbedBuilder } from "discord.js";
import { config } from "../../lib/config.js";
import type { ITrainedHorsesProps } from "../../lib/models.js";
import { fetchWithTimeout } from "../../lib/helpers/timeout-helpers.js";
import { horseName } from "../../lib/helpers/horse-funcs.js";

const { RACE_WAITING_DURATION } = config;

type Color = "red" | "blue" | "green" | "yellow" | "purple";

type RaceParticipant = {
	id: string;
	horse?: ITrainedHorsesProps | undefined;
};

type UpdateAction = (
	update: EmbedBuilder,
	rawUpdate: Array<ITrainedHorsesProps | undefined>,
) => void;

export type ReadyRaceChallenge = {
	readonly participants: ReadonlyArray<{
		readonly id: string;
		readonly horse: ITrainedHorsesProps;
	}>;
};

const slotColors: readonly Color[] = [
	"red",
	"blue",
	"green",
	"yellow",
	"purple",
];

export class UnreadyRaceChallenge {
	public readonly promise: Promise<ReadyRaceChallenge | undefined>;

	private resolveFn!: (value: ReadyRaceChallenge) => void;

	private resolveStatus: "waiting" | "ready" | "expired" =
		"waiting";

	private updateAction?: UpdateAction;

	private readonly participants: RaceParticipant[];

	private readonly colors: readonly Color[];

	/**
	 * @throws If less than 2 or more than 5 *participants* are given.
	 * @param participantIds The user IDs of the participants. There must be between 2 and 5.
	 */
	constructor(participantIds: readonly string[]) {
		if (participantIds.length < 2 || participantIds.length > 5) {
			throw new Error(
				"A race requires between 2 and 5 players",
			);
		}

		this.colors = slotColors.slice(0, participantIds.length);
		this.participants = participantIds.map((id) => ({ id }));

		const successPromise = new Promise<ReadyRaceChallenge>(
			(resolve) => {
				this.resolveFn = resolve;
			},
		);

		this.promise = fetchWithTimeout(
			successPromise,
			RACE_WAITING_DURATION,
		);

		void this.promise.then((result) => {
			this.resolveStatus =
				result === undefined ? "expired" : "ready";
		});
	}

	public onUpdate(updateAction: UpdateAction) {
		this.updateAction = updateAction;
	}

	/**
	 * @throws If *isForced* is false/unspecified and there is already a horse selected.
	 * @throws If the specified *color* is not participting in the race.
	 * @throws If the race has expired/proceeded.
	 * @param color The internal color designation of the user to add the horse to.
	 * @param horse The trained horse that will compete for the user. Use .lean() on the mongoose document.
	 * @param isForced If true, it will not throw if there is a horse already selected for that player. It will just replace that horse.
	 */
	public addHorse(
		color: Color,
		horse: ITrainedHorsesProps,
		isForced?: boolean,
	): void {
		this.checkStatus();

		const participant = this.getParticipant(color);
		if (!participant) {
			throw new Error("That color is not part of this race");
		}

		if (!participant.horse || isForced) {
			participant.horse = horse;
			if (this.updateAction) {
				this.updateAction(this.horsesEmbed, this.horses);
			}

			return;
		}

		throw new Error("There is already a horse");
	}

	/**
	 * @throws If the race has expired/proceeded.
	 * @throws If the specified *color* is not part of the race.
	 * @param color The internal color designated for the user whose horse to remove.
	 * @returns The horse that was removed.
	 */
	public removeHorse(
		color: Color,
	): ITrainedHorsesProps | undefined {
		this.checkStatus();

		const participant = this.getParticipant(color);
		if (!participant) {
			throw new Error("That color is not part of this race");
		}

		const { horse } = participant;
		const horseCopy = horse ? { ...horse } : undefined;

		participant.horse = undefined;
		if (this.updateAction) {
			this.updateAction(this.horsesEmbed, this.horses);
		}

		return horseCopy;
	}

	/**
	 * @throws If any of the participants have no selected horse.
	 * @throws If the race has expired/proceeded.
	 * @returns The readied race challenge, with each participant's user ID and horse, but no special methods.
	 */
	public toReady(): ReadyRaceChallenge {
		this.checkStatus();

		if (
			this.participants.some(
				(participant) => !participant.horse,
			)
		) {
			throw new Error("The horses have not been specified");
		}

		const finalRaceChallenge: ReadyRaceChallenge = {
			participants: this.participants.map((participant) => ({
				id: participant.id,
				horse: participant.horse!, // Has to exist bc of the .some()
			})),
		};
		this.resolveFn(finalRaceChallenge);
		return finalRaceChallenge;
	}

	public getColor(id: string): Color | undefined {
		const participantIndex = this.participants.findIndex(
			(participant) => participant.id === id,
		);
		if (participantIndex === -1) {
			return undefined;
		}

		return this.colors[participantIndex];
	}

	public get horses(): Array<ITrainedHorsesProps | undefined> {
		return this.participants.map(
			(participant) => participant.horse,
		);
	}

	public get ids(): Partial<Record<Color, string>> {
		const ids: Partial<Record<Color, string>> = {};
		for (const [index, color] of this.colors.entries()) {
			const participant = this.participants[index];
			if (participant) {
				ids[color] = participant.id;
			}
		}

		return ids;
	}

	public get isReady(): boolean {
		return this.participants.every((participant) =>
			Boolean(participant.horse),
		);
	}

	public get horsesEmbed() {
		const fields = this.colors.map((color, index) => {
			const horse = this.participants[index]?.horse;
			const label =
				color.charAt(0).toUpperCase() + color.slice(1);
			const value = horse
				? `${horse.name}, a ${horseName(horse.breed)}`
				: "none";
			return {
				name: label,
				value,
			};
		});

		return new EmbedBuilder()
			.setColor("#954535")
			.setTitle("Selected Horses")
			.addFields(...fields);
	}

	/**
	 * @throws If the race challenge has expired or become ready and proceeded
	 */
	private checkStatus(): void {
		if (this.resolveStatus === "expired") {
			throw new Error("This challenge has already expired");
		}

		if (this.resolveStatus === "ready") {
			throw new Error(
				"This challenge has already become ready and proceeded",
			);
		}
	}

	private getParticipant(
		color: Color,
	): RaceParticipant | undefined {
		const participantIndex = this.colors.indexOf(color);
		return this.participants[participantIndex];
	}
}

// eslint-disable-next-line unicorn/prevent-abbreviations
export const raceMaster = {
	raceMap: new Map<string, UnreadyRaceChallenge>(),
	/**
	 * @throws If a race already exists in that channel.
	 * @throws If less than 2 or more than 5 participants are given.
	 * @param channelId The channel ID where the race is participating. Only one race can exist per channel.
	 * @param participantIds The IDs of each participant. There must be between 2 and 5.
	 * @returns The UnreadyRaceChallenge class instance, which is also stored in raceMaster's raceMap and accessible using raceMaster.get().
	 */
	new(channelId: string, participantIds: readonly string[]) {
		if (this.exists(channelId)) {
			throw new Error(
				`A race challenge is already active in channel ${channelId}`,
			);
		}

		const race = new UnreadyRaceChallenge(participantIds);
		this.raceMap.set(channelId, race);

		void race.promise.finally(() => {
			this.raceMap.delete(channelId);
		});

		return race;
	},
	get(channelId: string) {
		return this.raceMap.get(channelId);
	},
	exists(channelId: string): boolean {
		return this.raceMap.has(channelId);
	},
	/**
	 * @throws If any of the participants have no selected horse.
	 * @throws If the race has expired/proceeded.
	 * @throws If there is no race stored for that channel.
	 * @param channelId The channel ID of the race to remove.
	 * @returns The readied race challenge, with each participant's user ID and horse, but no special methods.
	 */
	close(channelId: string): ReadyRaceChallenge {
		const race = this.raceMap.get(channelId);
		if (!race) {
			throw new Error(
				`No race in channel ${channelId} found in the race map`,
			);
		}

		return race.toReady();
	},
};
